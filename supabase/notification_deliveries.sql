-- ==============================================================================
-- ClassMate Phase 3D: Notification Deliveries Log & Atomic Claim Ledger
-- Target Project: https://nqnnterukpgvlswsrhmm.supabase.co
--
-- INSTRUCTIONS:
--   Do NOT run this automatically. Execute manually in the Supabase SQL Editor:
--   https://supabase.com/dashboard/project/nqnnterukpgvlswsrhmm/sql
--
--   Run AFTER push_subscriptions.sql has been executed.
--   This file is additive — it does NOT modify existing tables.
-- ==============================================================================


-- ==============================================================================
-- 1. Create notification_deliveries table
--
-- Purpose: Durable server-side deduplication log and claim-before-send ledger.
--   Each row represents a claimed or sent push notification.
--
--   State Machine:
--     • 'pending' : An active scheduler invocation claimed ownership before sending.
--     • 'sent'    : Push confirmed delivered to at least one device.
--     • 'failed'  : Push delivery failed on all devices (eligible for reclaim if still due).
--
--   The unique constraint (user_id, class_id, class_date, lead_minutes) guarantees
--   that only ONE concurrent scheduler invocation can claim and dispatch the push.
-- ==============================================================================

create table if not exists public.notification_deliveries (
  id            uuid primary key default gen_random_uuid(),

  -- The user who receives the notification
  user_id       uuid not null references auth.users(id) on delete cascade,

  -- The class this notification is about (matches public.classes.id)
  class_id      text not null,

  -- Calendar date of the class occurrence (YYYY-MM-DD, IST)
  class_date    date not null,

  -- How many minutes before class start the notification was scheduled (5/10/15/30)
  lead_minutes  int not null,

  -- State machine: 'pending' (claimed), 'sent' (delivered), 'failed' (delivery error)
  status        text not null default 'pending'
                check (status in ('pending', 'sent', 'failed')),

  -- Timestamp when the delivery was claimed by a scheduler invocation
  claimed_at    timestamptz not null default timezone('utc'::text, now()),

  -- When the push was confirmed sent (null while pending)
  sent_at       timestamptz,

  -- Error detail if delivery failed
  error         text,

  -- Audit timestamp
  created_at    timestamptz not null default timezone('utc'::text, now()),

  -- The logical notification identity: one claim/delivery per user/class/date/lead combination
  constraint uq_notification_delivery
    unique (user_id, class_id, class_date, lead_minutes)
);

-- Idempotent column additions for pre-existing tables:
alter table public.notification_deliveries
  add column if not exists status text not null default 'pending'
  check (status in ('pending', 'sent', 'failed'));

alter table public.notification_deliveries
  add column if not exists claimed_at timestamptz not null default timezone('utc'::text, now());

alter table public.notification_deliveries
  add column if not exists error text;

alter table public.notification_deliveries
  alter column sent_at drop not null;


-- ==============================================================================
-- 2. Indexes
-- ==============================================================================

-- Fast existence check by user on a given date (scheduler look-ahead)
create index if not exists idx_notification_deliveries_user_date
  on public.notification_deliveries(user_id, class_date);

-- Fast lookup by class_id (useful for analytics / debugging)
create index if not exists idx_notification_deliveries_class_id
  on public.notification_deliveries(class_id);

-- Fast query for stale/pending claim recovery
create index if not exists idx_notification_deliveries_status_claimed
  on public.notification_deliveries(status, claimed_at);


-- ==============================================================================
-- 3. Enable Row Level Security
-- ==============================================================================

alter table public.notification_deliveries enable row level security;


-- ==============================================================================
-- 4. RLS Policies
--
-- Users can READ their own delivery records (useful for debugging in future).
-- Users CANNOT insert, update, or delete delivery records — only the server
-- (Edge Function via service role) may write to this table.
-- This prevents students from falsely claiming or modifying delivery records.
-- ==============================================================================

-- SELECT: user can read their own delivery history
drop policy if exists "Users can read own notification deliveries"
  on public.notification_deliveries;

create policy "Users can read own notification deliveries"
  on public.notification_deliveries
  for select
  using (auth.uid() = user_id);

-- No INSERT policy for users — the Edge Function uses the service role key
-- which bypasses RLS entirely. Students cannot forge delivery records.

-- ==============================================================================
-- END OF MIGRATION
-- ==============================================================================
