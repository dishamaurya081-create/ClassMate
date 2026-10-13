# send-push-notification — ClassMate Phase 3D Edge Function

## What it does

This Supabase Edge Function is the background Web Push scheduler for ClassMate.
It processes all students with push notifications enabled and sends class reminders
via the Web Push Protocol, even when the ClassMate browser tab is closed.

## Architecture

```
Scheduler (cron) -> POST /functions/v1/send-push-notification
  -> Fetch profiles (reminders_enabled=true)
  -> Fetch today's official classes
  -> Per student:
       -> Filter classes (section + DV batch + group)
       -> Find due notification window (IST time)
       -> Check notification_deliveries (dedup)
       -> Fetch push_subscriptions
       -> Send Web Push (VAPID signed)
       -> Log to notification_deliveries
       -> On 410/404: delete expired subscription
```

## Required Supabase Secrets

Set these in: Dashboard -> Settings -> Edge Functions -> Secrets

| Secret             | Description                                      |
|--------------------|--------------------------------------------------|
| VAPID_PUBLIC_KEY   | Your VAPID public key (base64url)                |
| VAPID_PRIVATE_KEY  | Your VAPID private key (base64url) — KEEP SECRET |
| VAPID_SUBJECT      | mailto:you@example.com or https://your-domain.com |

SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are automatically injected by Supabase.

## Generating VAPID Keys

Run once on your local machine (NOT in the repo):

```bash
npx web-push generate-vapid-keys
```

Output:
  Public Key:  <copy to VAPID_PUBLIC_KEY secret AND to VITE_VAPID_PUBLIC_KEY in .env>
  Private Key: <copy ONLY to VAPID_PRIVATE_KEY secret — never put in Git>

## Deploying the Edge Function

```bash
# Install Supabase CLI if needed
npm install -g supabase

# Link to your project
supabase link --project-ref nqnnterukpgvlswsrhmm

# Deploy (do NOT run until you are ready for production)
supabase functions deploy send-push-notification
```

## Scheduler Setup

### Option A: Supabase pg_cron (Pro plan, $25/month)

In the Supabase SQL Editor, run:

```sql
select cron.schedule(
  'classmate-push-scheduler',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := current_setting(''app.supabase_url'') || ''/functions/v1/send-push-notification'',
    headers := jsonb_build_object(
      ''Authorization'', ''Bearer '' || current_setting(''app.anon_key''),
      ''Content-Type'', ''application/json''
    ),
    body := ''{}''
  );
  $$
);
```

### Option B: External Cron (Free, any plan)

Use any external cron service:
- GitHub Actions scheduled workflow
- Upstash QStash (free tier available)
- Railway cron
- Any server with `curl`

Call every 5 minutes:
```bash
curl -X POST \
  https://nqnnterukpgvlswsrhmm.supabase.co/functions/v1/send-push-notification \
  -H "Authorization: Bearer <YOUR_SUPABASE_ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Timezone

All class times are treated as IST (Asia/Kolkata, UTC+5:30).
The function converts UTC server time to IST before any scheduling calculations.

## SQL Migrations to Run First

Run these in order in the Supabase SQL Editor:
1. supabase/push_subscriptions.sql (Phase 3C)
2. supabase/notification_deliveries.sql (Phase 3D)

## Reminder Window

A notification fires when:
  (classStartTime - leadMinutes - 2 minutes) <= currentISTTime < classStartTime

The 2-minute jitter tolerance handles cron firing slightly early.
A notification is NEVER sent after the class has already started.
