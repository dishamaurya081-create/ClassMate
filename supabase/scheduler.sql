-- ClassMate Phase 3D — Background Push Notification Scheduler (pg_cron + pg_net + Vault)
-- Runs every 5 minutes and calls the send-push-notification Edge Function.
-- The shared secret is retrieved dynamically at runtime from vault.decrypted_secrets.

-- 1. Idempotently remove existing job if present
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'classmate-notification-scheduler') THEN
    PERFORM cron.unschedule('classmate-notification-scheduler');
  END IF;
END $$;

-- 2. Schedule the pg_cron job to invoke the deployed Edge Function every 5 minutes
SELECT cron.schedule(
  'classmate-notification-scheduler',
  '*/5 * * * *',
  'SELECT net.http_post('
    || 'url := ''https://nqnnterukpgvlswsrhmm.supabase.co/functions/v1/send-push-notification'', '
    || 'headers := jsonb_build_object('
      || '''Content-Type'', ''application/json'', '
      || '''X-Scheduler-Token'', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = ''scheduler_secret'' LIMIT 1)'
    || '), '
    || 'body := ''{}''::jsonb, '
    || 'timeout_milliseconds := 15000'
  || ');'
);
