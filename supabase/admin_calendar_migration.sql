-- ==============================================================================
-- ClassMate: Admin Calendar, Gmail-Based Admin Access & Class Suspension Migration
-- Primary Administrator: dishamaurya081@gmail.com
-- Target: Supabase Postgres
-- ==============================================================================

-- 1. Create admin_users table
CREATE TABLE IF NOT EXISTS public.admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('primary_admin', 'admin')),
  granted_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index for fast lookup by user_id and email
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON public.admin_users (user_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON public.admin_users (lower(email));

-- 2. Helper function: is_primary_admin()
-- Returns true if current user is dishamaurya081@gmail.com or has role 'primary_admin'
CREATE OR REPLACE FUNCTION public.is_primary_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
  SELECT (
    lower(coalesce(auth.jwt() ->> 'email', '')) = 'dishamaurya081@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid() AND role = 'primary_admin'
    )
    OR lower(coalesce((SELECT email FROM auth.users WHERE id = auth.uid()), '')) = 'dishamaurya081@gmail.com'
  );
$$;

-- 3. Helper function: is_admin()
-- Returns true if current user is primary admin or an active additional admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
  SELECT (
    public.is_primary_admin()
    OR EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid()
    )
    OR coalesce((SELECT is_creator FROM public.profiles WHERE id = auth.uid()), false)
  );
$$;

-- Also update public.is_creator() for backwards compatibility
CREATE OR REPLACE FUNCTION public.is_creator()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
  SELECT public.is_admin();
$$;

-- 4. RPC: grant_admin_access(target_email)
-- Only the primary administrator (dishamaurya081@gmail.com) can call this function.
CREATE OR REPLACE FUNCTION public.grant_admin_access(target_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_is_primary boolean;
  v_target_user record;
  v_existing_admin record;
  v_clean_email text;
BEGIN
  -- 1. Verify caller is primary administrator
  v_caller_is_primary := public.is_primary_admin();
  IF NOT v_caller_is_primary THEN
    RAISE EXCEPTION 'Unauthorized: Only the primary administrator (dishamaurya081@gmail.com) can grant admin access.';
  END IF;

  -- 2. Validate target email
  v_clean_email := lower(trim(target_email));
  IF v_clean_email IS NULL OR v_clean_email = '' THEN
    RAISE EXCEPTION 'Gmail address is required.';
  END IF;

  IF NOT (v_clean_email ~* '^[A-Za-z0-9._%+-]+@gmail\.com$') THEN
    -- If not strictly @gmail.com, verify standard valid email
    IF NOT (v_clean_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$') THEN
      RAISE EXCEPTION 'Invalid email address format.';
    END IF;
  END IF;

  -- Cannot re-grant primary admin
  IF v_clean_email = 'dishamaurya081@gmail.com' THEN
    RAISE EXCEPTION 'dishamaurya081@gmail.com is already the primary administrator.';
  END IF;

  -- 3. Confirm target account exists in Supabase Auth
  SELECT id, email, email_confirmed_at INTO v_target_user
  FROM auth.users
  WHERE lower(email) = v_clean_email;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No ClassMate account found with email "%". The student must register and create a ClassMate account first.', v_clean_email;
  END IF;

  -- 4. Check for duplicate admin entry
  SELECT id, role INTO v_existing_admin
  FROM public.admin_users
  WHERE user_id = v_target_user.id OR lower(email) = v_clean_email;

  IF FOUND THEN
    RAISE EXCEPTION 'Account "%" is already an authorized administrator.', v_clean_email;
  END IF;

  -- 5. Insert into admin_users with role = 'admin'
  INSERT INTO public.admin_users (
    user_id,
    email,
    role,
    granted_by,
    created_at,
    updated_at
  ) VALUES (
    v_target_user.id,
    v_clean_email,
    'admin',
    auth.uid(),
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  );

  -- Set is_creator on profile for compatibility
  UPDATE public.profiles
  SET is_creator = true, updated_at = timezone('utc'::text, now())
  WHERE id = v_target_user.id;

  RETURN jsonb_build_object(
    'success', true,
    'userId', v_target_user.id,
    'email', v_clean_email,
    'role', 'admin',
    'message', 'Administrator access successfully granted to ' || v_clean_email
  );
END;
$$;

-- 5. RPC: revoke_admin_access(target_user_id)
-- Only the primary administrator (dishamaurya081@gmail.com) can call this function.
CREATE OR REPLACE FUNCTION public.revoke_admin_access(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_is_primary boolean;
  v_target_row record;
BEGIN
  -- 1. Verify caller is primary administrator
  v_caller_is_primary := public.is_primary_admin();
  IF NOT v_caller_is_primary THEN
    RAISE EXCEPTION 'Unauthorized: Only the primary administrator (dishamaurya081@gmail.com) can revoke admin access.';
  END IF;

  -- 2. Check target exists and cannot be primary admin
  SELECT id, user_id, email, role INTO v_target_row
  FROM public.admin_users
  WHERE user_id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target user is not an administrator.';
  END IF;

  IF v_target_row.role = 'primary_admin' OR lower(v_target_row.email) = 'dishamaurya081@gmail.com' THEN
    RAISE EXCEPTION 'The primary administrator cannot be revoked or demoted.';
  END IF;

  -- 3. Delete from admin_users
  DELETE FROM public.admin_users
  WHERE user_id = target_user_id AND role = 'admin';

  -- 4. Update profiles table
  UPDATE public.profiles
  SET is_creator = false, updated_at = timezone('utc'::text, now())
  WHERE id = target_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'userId', target_user_id,
    'message', 'Administrator access successfully revoked for ' || v_target_row.email
  );
END;
$$;

-- 6. Setup / Seed Function for Primary Admin
CREATE OR REPLACE FUNCTION public.setup_primary_admin()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_primary_user record;
BEGIN
  SELECT id, email INTO v_primary_user
  FROM auth.users
  WHERE lower(email) = 'dishamaurya081@gmail.com';

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Account dishamaurya081@gmail.com is not yet registered in auth.users. Once registered, execute setup_primary_admin() or sign in.'
    );
  END IF;

  INSERT INTO public.admin_users (
    user_id,
    email,
    role,
    granted_by,
    created_at,
    updated_at
  ) VALUES (
    v_primary_user.id,
    'dishamaurya081@gmail.com',
    'primary_admin',
    v_primary_user.id,
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  ) ON CONFLICT (user_id) DO UPDATE SET
    role = 'primary_admin',
    email = 'dishamaurya081@gmail.com',
    updated_at = timezone('utc'::text, now());

  UPDATE public.profiles
  SET is_creator = true, updated_at = timezone('utc'::text, now())
  WHERE id = v_primary_user.id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Primary administrator dishamaurya081@gmail.com initialized successfully.'
  );
END;
$$;

-- 7. Automatic trigger when dishamaurya081@gmail.com registers or logs in
CREATE OR REPLACE FUNCTION public.handle_primary_admin_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF lower(new.email) = 'dishamaurya081@gmail.com' THEN
    INSERT INTO public.admin_users (
      user_id,
      email,
      role,
      granted_by,
      created_at,
      updated_at
    ) VALUES (
      new.id,
      'dishamaurya081@gmail.com',
      'primary_admin',
      new.id,
      timezone('utc'::text, now()),
      timezone('utc'::text, now())
    ) ON CONFLICT (user_id) DO UPDATE SET
      role = 'primary_admin',
      email = 'dishamaurya081@gmail.com',
      updated_at = timezone('utc'::text, now());

    UPDATE public.profiles
    SET is_creator = true
    WHERE id = new.id;
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_primary_admin_signup ON auth.users;
CREATE TRIGGER on_auth_primary_admin_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_primary_admin_signup();

-- Run setup immediately in case dishamaurya081@gmail.com already exists in auth.users
SELECT public.setup_primary_admin();

-- 8. Enable Row Level Security (RLS) on admin_users
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view admin list" ON public.admin_users;
CREATE POLICY "Admins can view admin list"
  ON public.admin_users
  FOR SELECT
  USING (public.is_admin() = true);

DROP POLICY IF EXISTS "Only primary admin can insert admin users" ON public.admin_users;
CREATE POLICY "Only primary admin can insert admin users"
  ON public.admin_users
  FOR INSERT
  WITH CHECK (public.is_primary_admin() = true);

DROP POLICY IF EXISTS "Only primary admin can update admin users" ON public.admin_users;
CREATE POLICY "Only primary admin can update admin users"
  ON public.admin_users
  FOR UPDATE
  USING (public.is_primary_admin() = true);

DROP POLICY IF EXISTS "Only primary admin can delete admin users" ON public.admin_users;
CREATE POLICY "Only primary admin can delete admin users"
  ON public.admin_users
  FOR DELETE
  USING (public.is_primary_admin() = true AND role <> 'primary_admin');

-- 9. Update RLS policies on official_events and class_suspensions to use is_admin()
DROP POLICY IF EXISTS "Authenticated users can read published events" ON public.official_events;
CREATE POLICY "Authenticated users can read published events"
  ON public.official_events
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND (published = true OR public.is_admin() = true));

DROP POLICY IF EXISTS "Creator can read all events including drafts" ON public.official_events;
DROP POLICY IF EXISTS "Creator can insert events" ON public.official_events;
CREATE POLICY "Admins can insert events"
  ON public.official_events
  FOR INSERT
  WITH CHECK (public.is_admin() = true AND auth.uid() = created_by);

DROP POLICY IF EXISTS "Creator can update events" ON public.official_events;
CREATE POLICY "Admins can update events"
  ON public.official_events
  FOR UPDATE
  USING (public.is_admin() = true);

DROP POLICY IF EXISTS "Creator can delete events" ON public.official_events;
CREATE POLICY "Admins can delete events"
  ON public.official_events
  FOR DELETE
  USING (public.is_admin() = true);

-- Class suspensions RLS
DROP POLICY IF EXISTS "Authenticated users can read published suspensions" ON public.class_suspensions;
CREATE POLICY "Authenticated users can read published suspensions"
  ON public.class_suspensions
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND (published = true OR public.is_admin() = true));

DROP POLICY IF EXISTS "Creator can read all suspensions including drafts" ON public.class_suspensions;
DROP POLICY IF EXISTS "Creator can insert suspensions" ON public.class_suspensions;
CREATE POLICY "Admins can insert suspensions"
  ON public.class_suspensions
  FOR INSERT
  WITH CHECK (public.is_admin() = true AND auth.uid() = created_by);

DROP POLICY IF EXISTS "Creator can update suspensions" ON public.class_suspensions;
CREATE POLICY "Admins can update suspensions"
  ON public.class_suspensions
  FOR UPDATE
  USING (public.is_admin() = true);

DROP POLICY IF EXISTS "Creator can delete suspensions" ON public.class_suspensions;
CREATE POLICY "Admins can delete suspensions"
  ON public.class_suspensions
  FOR DELETE
  USING (public.is_admin() = true);

-- ==============================================================================
-- INSTRUCTIONS FOR INITIAL SETUP:
-- Run this entire script in Supabase SQL Editor.
-- Primary administrator dishamaurya081@gmail.com will immediately be recognized.
-- ==============================================================================
