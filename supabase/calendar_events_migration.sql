-- ==============================================================================
-- ClassMate: Official Academic Calendar, Holidays & Class Suspension Migration
-- Target: Supabase Postgres
-- ==============================================================================

-- 1. Add is_creator column to profiles table if not present
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_creator boolean NOT NULL DEFAULT false;

-- 2. Trigger to prevent non-privileged users from self-elevating is_creator
-- Students cannot grant themselves creator privileges via browser client or direct REST requests.
CREATE OR REPLACE FUNCTION public.protect_profile_creator_field()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- If is_creator is being changed by an authenticated client, block it
  IF NEW.is_creator IS DISTINCT FROM OLD.is_creator THEN
    IF current_setting('request.jwt.claim.role', true) = 'authenticated' THEN
      -- Allow update only if current user is already a creator (or postgres/service_role)
      IF NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND is_creator = true
      ) THEN
        RAISE EXCEPTION 'Modifying creator privileges is not permitted.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_creator ON public.profiles;
CREATE TRIGGER trg_protect_profile_creator
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_creator_field();

-- 3. Create helper function is_creator() for RLS
CREATE OR REPLACE FUNCTION public.is_creator()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (SELECT is_creator FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

-- 4. Official Events Table
CREATE TABLE IF NOT EXISTS public.official_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  event_type text NOT NULL CHECK (
    event_type IN ('holiday', 'training', 'college_event', 'exam', 'workshop', 'announcement', 'other')
  ),
  start_date date NOT NULL,
  end_date date,
  start_time text, -- HH:mm (24h)
  end_time text,   -- HH:mm (24h)
  location text,
  description text,
  cancels_classes boolean NOT NULL DEFAULT false,
  published boolean NOT NULL DEFAULT false,
  affected_section text,  -- null means applies to all sections
  affected_batch text,    -- null means applies to all batches (e.g. DV Batch 1, Cloud)
  affected_group text,    -- null means applies to all groups (e.g. Group 1, Group 2)
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. Class Suspensions Table
CREATE TABLE IF NOT EXISTS public.class_suspensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  start_date date NOT NULL,
  end_date date,
  suspension_type text NOT NULL CHECK (
    suspension_type IN ('full_day', 'after_cutoff', 'period')
  ),
  cutoff_time text,       -- HH:mm (24h), required for after_cutoff and period
  period_end_time text,   -- HH:mm (24h), required for period
  description text,
  affected_section text,  -- null means all sections
  affected_batch text,    -- null means all batches
  affected_group text,    -- null means all groups
  published boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. Indexes for high-performance calendar lookups and notification queries
CREATE INDEX IF NOT EXISTS idx_official_events_dates
  ON public.official_events (start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_official_events_published
  ON public.official_events (published);

CREATE INDEX IF NOT EXISTS idx_official_events_type
  ON public.official_events (event_type);

CREATE INDEX IF NOT EXISTS idx_class_suspensions_dates
  ON public.class_suspensions (start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_class_suspensions_published
  ON public.class_suspensions (published);

-- 7. Enable Row Level Security (RLS)
ALTER TABLE public.official_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_suspensions ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies for official_events
DROP POLICY IF EXISTS "Authenticated users can read published events" ON public.official_events;
CREATE POLICY "Authenticated users can read published events"
  ON public.official_events
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND published = true);

DROP POLICY IF EXISTS "Creator can read all events including drafts" ON public.official_events;
CREATE POLICY "Creator can read all events including drafts"
  ON public.official_events
  FOR SELECT
  USING (public.is_creator() = true);

DROP POLICY IF EXISTS "Creator can insert events" ON public.official_events;
CREATE POLICY "Creator can insert events"
  ON public.official_events
  FOR INSERT
  WITH CHECK (public.is_creator() = true AND auth.uid() = created_by);

DROP POLICY IF EXISTS "Creator can update events" ON public.official_events;
CREATE POLICY "Creator can update events"
  ON public.official_events
  FOR UPDATE
  USING (public.is_creator() = true);

DROP POLICY IF EXISTS "Creator can delete events" ON public.official_events;
CREATE POLICY "Creator can delete events"
  ON public.official_events
  FOR DELETE
  USING (public.is_creator() = true);

-- 9. RLS Policies for class_suspensions
DROP POLICY IF EXISTS "Authenticated users can read published suspensions" ON public.class_suspensions;
CREATE POLICY "Authenticated users can read published suspensions"
  ON public.class_suspensions
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND published = true);

DROP POLICY IF EXISTS "Creator can read all suspensions including drafts" ON public.class_suspensions;
CREATE POLICY "Creator can read all suspensions including drafts"
  ON public.class_suspensions
  FOR SELECT
  USING (public.is_creator() = true);

DROP POLICY IF EXISTS "Creator can insert suspensions" ON public.class_suspensions;
CREATE POLICY "Creator can insert suspensions"
  ON public.class_suspensions
  FOR INSERT
  WITH CHECK (public.is_creator() = true AND auth.uid() = created_by);

DROP POLICY IF EXISTS "Creator can update suspensions" ON public.class_suspensions;
CREATE POLICY "Creator can update suspensions"
  ON public.class_suspensions
  FOR UPDATE
  USING (public.is_creator() = true);

DROP POLICY IF EXISTS "Creator can delete suspensions" ON public.class_suspensions;
CREATE POLICY "Creator can delete suspensions"
  ON public.class_suspensions
  FOR DELETE
  USING (public.is_creator() = true);

-- ==============================================================================
-- ONE-TIME CREATOR SETUP INSTRUCTIONS
-- ==============================================================================
-- To grant your own user creator permissions, run this in the Supabase SQL Editor:
--
--   UPDATE public.profiles
--   SET is_creator = true
--   WHERE email = 'your-email@example.com';
--
-- Or via auth id:
--   UPDATE public.profiles
--   SET is_creator = true
--   WHERE id = '<your-auth-user-uuid>';
-- ==============================================================================
