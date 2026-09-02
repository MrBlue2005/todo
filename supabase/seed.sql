-- Run after creating a development user. Replace the UUID once, then execute in the SQL editor.
do $$ declare uid uuid := '00000000-0000-0000-0000-000000000000'; one_id uuid; villa_id uuid; primavera_id uuid;
begin
  if not exists(select 1 from auth.users where id=uid) then raise notice 'Replace uid in supabase/seed.sql with a real auth.users id.'; return; end if;
  insert into public.properties(user_id,name,address,status,description) values
  (uid,'ONE Herastrau Residence','Strada Nicolae G. Caramfil 74A, Bucharest','active','Premium residence overlooking Herastrau.') returning id into one_id;
  insert into public.properties(user_id,name,address,status,description) values
  (uid,'Iancu Nicolae Villa','Erou Iancu Nicolae, Voluntari','active','Private family villa with garden and pool.') returning id into villa_id;
  insert into public.properties(user_id,name,address,status) values(uid,'Primaverii Residence','Bulevardul Primaverii, Bucharest','new') returning id into primavera_id;
  insert into public.tasks(user_id,property_id,title,description,category,priority,due_date,due_time,recurrence_rule) values
  (uid,one_id,'Monthly property report','Prepare owner-facing activity update.','report','high',current_date,'17:00','{"frequency":"monthly","interval":1}'),
  (uid,villa_id,'Call owner regarding price adjustment','Review current interest before the call.','property','urgent',current_date-1,'10:30',null),
  (uid,primavera_id,'Update property description','Add revised amenities and positioning copy.','property','normal',current_date+1,null,null);
end $$;
