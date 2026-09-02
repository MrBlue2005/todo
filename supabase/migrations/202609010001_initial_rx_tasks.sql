create extension if not exists pgcrypto;

create type public.task_category as enum ('task','property','report','campaign','reminder');
create type public.task_priority as enum ('low','normal','high','urgent');
create type public.task_status as enum ('todo','completed','cancelled');
create type public.property_status as enum ('new','active','paused','sold_closed','archived');
create type public.campaign_status as enum ('active','completed','cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.properties (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 180), address text not null default '', description text,
  status public.property_status not null default 'new', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.campaign_templates (
  id uuid primary key default gen_random_uuid(), slug text not null unique, name text not null, description text,
  is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.campaign_template_tasks (
  id uuid primary key default gen_random_uuid(), template_id uuid not null references public.campaign_templates(id) on delete cascade,
  title text not null, description text, day_offset integer not null check (day_offset >= 0), category public.task_category not null default 'campaign',
  priority public.task_priority not null default 'normal', position integer not null default 0, created_at timestamptz not null default now()
);
create table public.campaigns (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade, template_id uuid not null references public.campaign_templates(id),
  name text not null, status public.campaign_status not null default 'active', start_date date not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.tasks (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null, campaign_id uuid references public.campaigns(id) on delete set null,
  title text not null check (char_length(title) between 1 and 180), description text, category public.task_category not null default 'task',
  priority public.task_priority not null default 'normal', status public.task_status not null default 'todo', due_date date not null default current_date,
  due_time time, recurrence_rule jsonb, completed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint recurrence_rule_valid check (recurrence_rule is null or (recurrence_rule ? 'frequency' and recurrence_rule ? 'interval' and recurrence_rule->>'frequency' in ('daily','weekly','monthly') and (recurrence_rule->>'interval')::integer > 0)),
  constraint completed_at_matches_status check ((status = 'completed' and completed_at is not null) or (status <> 'completed'))
);
create table public.task_reminders (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade, remind_at timestamptz not null, offset_minutes integer,
  sent_at timestamptz, created_at timestamptz not null default now()
);
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null, p256dh text not null, auth text not null, user_agent text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(user_id, endpoint)
);

create index properties_user_status_idx on public.properties(user_id,status);
create index tasks_user_due_status_idx on public.tasks(user_id,due_date,status);
create index tasks_property_status_idx on public.tasks(property_id,status) where property_id is not null;
create index tasks_campaign_idx on public.tasks(campaign_id) where campaign_id is not null;
create index reminders_due_unsent_idx on public.task_reminders(remind_at) where sent_at is null;
create index campaigns_property_idx on public.campaigns(property_id,status);
create index push_subscriptions_user_idx on public.push_subscriptions(user_id);

create function public.set_updated_at() returns trigger language plpgsql set search_path = '' as $$ begin new.updated_at = now(); return new; end $$;
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger properties_updated before update on public.properties for each row execute function public.set_updated_at();
create trigger campaigns_updated before update on public.campaigns for each row execute function public.set_updated_at();
create trigger tasks_updated before update on public.tasks for each row execute function public.set_updated_at();
create trigger subscriptions_updated before update on public.push_subscriptions for each row execute function public.set_updated_at();

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin insert into public.profiles(id,display_name) values(new.id,coalesce(new.raw_user_meta_data->>'display_name',split_part(new.email,'@',1))); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

alter table public.profiles enable row level security; alter table public.properties enable row level security;
alter table public.tasks enable row level security; alter table public.task_reminders enable row level security;
alter table public.campaigns enable row level security; alter table public.campaign_templates enable row level security;
alter table public.campaign_template_tasks enable row level security; alter table public.push_subscriptions enable row level security;

create policy "profiles own select" on public.profiles for select using ((select auth.uid()) = id);
create policy "profiles own update" on public.profiles for update using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "properties own all" on public.properties for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "tasks own all" on public.tasks for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "reminders own all" on public.task_reminders for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "campaigns own all" on public.campaigns for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "subscriptions own all" on public.push_subscriptions for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "templates authenticated read" on public.campaign_templates for select to authenticated using (is_active);
create policy "template tasks authenticated read" on public.campaign_template_tasks for select to authenticated using (exists(select 1 from public.campaign_templates ct where ct.id=template_id and ct.is_active));

create function public.launch_campaign_from_template(p_property_id uuid,p_template_slug text,p_start_date date)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_template public.campaign_templates; v_campaign_id uuid; v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  select * into v_template from public.campaign_templates where slug=p_template_slug and is_active;
  if not found then raise exception 'Template not found'; end if;
  if not exists(select 1 from public.properties where id=p_property_id and user_id=v_user_id) then raise exception 'Property not found'; end if;
  insert into public.campaigns(user_id,property_id,template_id,name,start_date) values(v_user_id,p_property_id,v_template.id,v_template.name,p_start_date) returning id into v_campaign_id;
  insert into public.tasks(user_id,property_id,campaign_id,title,description,category,priority,due_date)
  select v_user_id,p_property_id,v_campaign_id,ctt.title,ctt.description,ctt.category,ctt.priority,p_start_date+ctt.day_offset
  from public.campaign_template_tasks ctt where ctt.template_id=v_template.id order by ctt.position;
  return v_campaign_id;
end $$;
grant execute on function public.launch_campaign_from_template(uuid,text,date) to authenticated;

insert into public.campaign_templates(slug,name,description) values('new-property-campaign','New Property Launch','RX seven-day property launch workflow');
insert into public.campaign_template_tasks(template_id,title,day_offset,position)
select id,title,day_offset,position from public.campaign_templates cross join (values
('Prepare / check photographs',0,1),('Write property description',0,2),('Publish on real estate portals',1,3),('Publish on RX website',1,4),
('Prepare social media content',1,5),('Launch social media campaign',1,6),('Check campaign performance',3,7),('Review results and make adjustments',7,8)
) as seed(title,day_offset,position) where slug='new-property-campaign';
