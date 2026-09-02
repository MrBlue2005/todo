# RX Tasks

RX Tasks is a phone-first operations app for RX real-estate workflows: daily work, property follow-ups, recurring reports, campaign launches, reminders, and deadlines. It is a Next.js PWA designed to feel like a focused premium iPhone application.

## Stack

- Next.js 16, React 19, strict TypeScript, Tailwind CSS 4
- Supabase Auth and PostgreSQL with Row Level Security
- Installable PWA with service worker and offline shell
- Standards-based Web Push using VAPID
- Vercel Cron-compatible reminder dispatcher

Without environment variables the app starts in a fully interactive demo workspace stored only on the current device. With Supabase configured, authenticated records are stored in PostgreSQL and protected by RLS.

## Run locally

Requirements: Node.js 20.9+ and npm.

```bash
npm install
copy .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. Quality checks:

```bash
npm run lint
npm run typecheck
npm run build
```

## Project map

- `src/app` — screens and server routes
- `src/components` — mobile shell, cards, sheets, and data provider
- `src/lib` — date/recurrence logic, Supabase clients, demo data
- `src/types` — domain types
- `supabase/migrations` — schema, constraints, functions, and RLS
- `supabase/seed.sql` — optional development data
- `public/sw.js` — offline shell and push handling

## Supabase setup

1. Create a Supabase project.
2. Run `supabase/migrations/202609010001_initial_rx_tasks.sql` in the SQL editor, or link the CLI and run `supabase db push`.
3. In Authentication → Providers, enable Email and Password. Choose whether new accounts require email confirmation.
4. Set the Site URL and allowed redirect URLs for local and production domains.
5. Copy the Project URL to `NEXT_PUBLIC_SUPABASE_URL` and the current publishable key to `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local`. A legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` remains supported as a fallback.
6. No service-role or secret key is required for authentication or normal app data access. Add a server-only elevated key later only when configuring scheduled reminder delivery; never expose or commit it.
7. Restart the development server. The proxy will then require authentication for app routes.

The migration creates `profiles`, `properties`, `tasks`, `task_reminders`, `campaigns`, `campaign_templates`, `campaign_template_tasks`, and `push_subscriptions`. Every user-owned table has RLS based on `auth.uid()`. Foreign keys, checks, indexes, ownership policies, profile provisioning, updated timestamps, and atomic campaign generation are included.

For database demo records, replace the placeholder UUID in `supabase/seed.sql` with an Auth user ID and run it. The client-side demo does not depend on this seed.

## Push notifications

Generate VAPID keys:

```bash
npx web-push generate-vapid-keys
```

Set `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, and a strong `CRON_SECRET`. Subscription is always initiated by the user from Profile; the app never prompts on first launch.

The `GET /api/cron/reminders` route loads due unsent reminders, sends them to every registered device, removes expired subscriptions, and marks reminders sent. Call it with:

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://YOUR_DOMAIN/api/cron/reminders
```

`vercel.json` schedules it every five minutes. On another host, configure an equivalent scheduler. Never use a browser timer for delivery.

On iPhone, push requires iOS 16.4+ and an installed Home Screen web app: open in Safari, Share → Add to Home Screen, launch RX Tasks from its icon, then enable notifications in Profile.

## Deployment

1. Create a Next.js project on the deployment provider.
2. Add every value from `.env.example` to production environment settings.
3. Deploy with `npm run build`.
4. Add the production origin to Supabase Authentication URL configuration.
5. Confirm `/manifest.webmanifest` and `/sw.js` are served over HTTPS.
6. Confirm the cron schedule and inspect its logs after a test reminder.

## Troubleshooting

- Web Push, service workers, and installation require HTTPS outside localhost.
- Denied notifications must be re-enabled in iOS settings.
- If Demo mode remains after adding Supabase values, restart Next.js.
- Recurring tasks create one next occurrence on completion, avoiding thousands of future rows.
- Campaign generation is atomic in PostgreSQL; the local demo mirrors the same eight-task template.
