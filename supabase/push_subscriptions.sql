-- ==============================================================================
-- ClassMate Phase 3C: Push Subscriptions Table & RLS
-- Target Project: https://nqnnterukpgvlswsrhmm.supabase.co
--
-- INSTRUCTIONS:
--   Do NOT run this automatically. Execute manually in the Supabase SQL Editor:
--   https://supabase.com/dashboard/project/nqnnterukpgvlswsrhmm/sql
--
--   This file is additive — it does NOT modify the existing profiles or classes tables.
-- ==============================================================================


-- ==============================================================================
-- 1. Create push_subscriptions table
-- ==============================================================================

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,

  -- The push endpoint URL (unique per browser/device per user)
  endpoint    text not null,

  -- Full serialised PushSubscription JSON (contains endpoint + keys)
  -- Stored as jsonb so the push sender can read it directly.
  -- Shape: { "endpoint": "...", "keys": { "p256dh": "...", "auth": "..." } }
  subscription_json jsonb not null,

  created_at  timestamptz not null default timezone('utc'::text, now()),
  updated_at  timestamptz not null default timezone('utc'::text, now()),

  -- Prevent duplicate subscriptions for the same user/device endpoint
  constraint uq_push_subscriptions_user_endpoint unique (user_id, endpoint)
);


-- ==============================================================================
-- 2. Indexes
-- ==============================================================================

-- Fast lookup by user_id (e.g. push sender fetching all devices for a user)
create index if not exists idx_push_subscriptions_user_id
  on public.push_subscriptions(user_id);

-- Fast lookup by endpoint (e.g. removing an invalid/expired subscription)
create index if not exists idx_push_subscriptions_endpoint
  on public.push_subscriptions(endpoint);


-- ==============================================================================
-- 3. Enable Row Level Security
-- ==============================================================================

alter table public.push_subscriptions enable row level security;


-- ==============================================================================
-- 4. RLS Policies — authenticated users manage only their own subscriptions
-- ==============================================================================

-- SELECT: user can read their own subscriptions only
drop policy if exists "Users can read own push subscriptions"
  on public.push_subscriptions;

create policy "Users can read own push subscriptions"
  on public.push_subscriptions
  for select
  using (auth.uid() = user_id);


-- INSERT: user can create their own subscription only
drop policy if exists "Users can insert own push subscriptions"
  on public.push_subscriptions;

create policy "Users can insert own push subscriptions"
  on public.push_subscriptions
  for insert
  with check (auth.uid() = user_id);


-- UPDATE: user can update their own subscription only (e.g. refresh endpoint)
drop policy if exists "Users can update own push subscriptions"
  on public.push_subscriptions;

create policy "Users can update own push subscriptions"
  on public.push_subscriptions
  for update
  using (auth.uid() = user_id);


-- DELETE: user can remove their own subscription only
drop policy if exists "Users can delete own push subscriptions"
  on public.push_subscriptions;

create policy "Users can delete own push subscriptions"
  on public.push_subscriptions
  for delete
  using (auth.uid() = user_id);


-- ==============================================================================
-- 5. updated_at auto-update trigger
-- ==============================================================================

create or replace function public.handle_push_subscription_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists set_push_subscriptions_updated_at
  on public.push_subscriptions;

create trigger set_push_subscriptions_updated_at
  before update on public.push_subscriptions
  for each row
  execute procedure public.handle_push_subscription_updated_at();


-- ==============================================================================
-- END OF MIGRATION
-- ==============================================================================
-- After running this SQL:
--   1. Verify the table exists in: Table Editor > push_subscriptions
--   2. Verify RLS is enabled (the shield icon should be green)
--   3. Verify all 4 policies appear under Authentication > Policies
--   4. No data is seeded — users create their own rows via the app
-- ==============================================================================
