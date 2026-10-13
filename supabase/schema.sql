-- ==============================================================================
-- ClassMate Phase 2: Supabase Database Schema & Row Level Security (RLS)
-- Target Project: https://nqnnterukpgvlswsrhmm.supabase.co
-- ==============================================================================


-- ==============================================================================
-- 1. Create profiles table linked to Supabase Auth
-- ==============================================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  student_name text default 'Disha',
  college text default 'ABES Engineering College',
  branch text default 'CSE',
  semester int default 3,
  section text not null default 'CSE-15',
  specialization_option text not null default 'DV Batch 1',
  student_group text not null default 'Group 1',
  onboarding_completed boolean not null default false,
  reminders_enabled boolean default true,
  remind_minutes_before int default 10,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);


-- ==============================================================================
-- 2. Create classes table
-- ==============================================================================

create table if not exists public.classes (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  section text not null default 'CSE-15',
  day text not null,
  subject text not null,
  course_code text not null,
  teacher text not null,
  room text not null,
  start_time text not null,
  end_time text not null,
  batch text,
  type text not null default 'lecture',
  notes text,
  is_official boolean default false not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);


-- Indexes
create index if not exists idx_classes_user_id
  on public.classes(user_id);

create index if not exists idx_classes_section_day
  on public.classes(section, day);

create index if not exists idx_classes_is_official
  on public.classes(is_official);


-- ==============================================================================
-- 3. Automatic Profile Creation Trigger on Sign Up
-- ==============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin

  insert into public.profiles (
    id,
    email,
    student_name,
    college,
    branch,
    semester,
    section,
    specialization_option,
    student_group,
    onboarding_completed,
    reminders_enabled,
    remind_minutes_before
  )
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'student_name',
      split_part(new.email, '@', 1)
    ),
    'ABES Engineering College',
    'CSE',
    3,
    'CSE-15',
    'DV Batch 1',
    'Group 1',
    false,
    true,
    10
  )
  on conflict (id) do update set
    email = excluded.email,
    updated_at = timezone('utc'::text, now());

  return new;
end;
$$;


-- Drop trigger if it already exists, then recreate it
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure public.handle_new_user();


-- ==============================================================================
-- 4. Enable Row Level Security (RLS)
-- ==============================================================================

alter table public.profiles enable row level security;
alter table public.classes enable row level security;


-- ==============================================================================
-- 5. RLS Policies for Profiles
-- ==============================================================================

drop policy if exists "Users can view own profile"
  on public.profiles;

create policy "Users can view own profile"
  on public.profiles
  for select
  using (auth.uid() = id);


drop policy if exists "Users can insert own profile"
  on public.profiles;

create policy "Users can insert own profile"
  on public.profiles
  for insert
  with check (auth.uid() = id);


drop policy if exists "Users can update own profile"
  on public.profiles;

create policy "Users can update own profile"
  on public.profiles
  for update
  using (auth.uid() = id);


-- ==============================================================================
-- 6. RLS Policies for Classes
-- ==============================================================================

-- Official timetable entries are readable only by authenticated users.
drop policy if exists "Authenticated users can read official classes"
  on public.classes;

-- Remove the old policy too, in case it exists from a previous schema version.
drop policy if exists "Anyone can read official classes"
  on public.classes;

create policy "Authenticated users can read official classes"
  on public.classes
  for select
  using (
    is_official = true
    and auth.uid() is not null
  );


-- Authenticated users can view their own custom/edited timetable entries.
drop policy if exists "Users can read own classes"
  on public.classes;

create policy "Users can read own classes"
  on public.classes
  for select
  using (auth.uid() = user_id);


-- Authenticated users can insert their own classes.
drop policy if exists "Users can insert own classes"
  on public.classes;

create policy "Users can insert own classes"
  on public.classes
  for insert
  with check (auth.uid() = user_id);


-- Authenticated users can update their own classes.
drop policy if exists "Users can update own classes"
  on public.classes;

create policy "Users can update own classes"
  on public.classes
  for update
  using (auth.uid() = user_id);


-- Authenticated users can delete their own classes.
drop policy if exists "Users can delete own classes"
  on public.classes;

create policy "Users can delete own classes"
  on public.classes
  for delete
  using (auth.uid() = user_id);


-- ==============================================================================
-- 7. Seed Official CSE-15 Timetable
-- ==============================================================================

insert into public.classes (
  id,
  user_id,
  section,
  day,
  subject,
  course_code,
  teacher,
  room,
  start_time,
  end_time,
  batch,
  type,
  is_official
)
values

  -- ============================================================================
  -- MONDAY
  -- ============================================================================

  (
    'mon-1',
    null,
    'CSE-15',
    'Monday',
    'DSTL',
    '25BOE 312',
    'Mr. Varun Kumar (VV)',
    'KC-204',
    '08:50',
    '09:40',
    null,
    'lecture',
    true
  ),

  (
    'mon-2',
    null,
    'CSE-15',
    'Monday',
    'Operating Systems',
    '25CS302',
    'Ms. Divya Maheswari (DM)',
    'KC-204',
    '09:40',
    '10:30',
    null,
    'lecture',
    true
  ),

  (
    'mon-3-g2',
    null,
    'CSE-15',
    'Monday',
    'OOPS WITH C++ LAB',
    '25CS351',
    'Mr. Dhaneshwar Kumar (DK)',
    'Lab-5',
    '10:40',
    '12:20',
    'G2',
    'lab',
    true
  ),

  (
    'mon-3-g1',
    null,
    'CSE-15',
    'Monday',
    'OS LAB',
    '25CS352',
    'Dr. Kadambri Agarwal (KA)',
    'Lab-4',
    '10:40',
    '12:20',
    'G1',
    'lab',
    true
  ),

  (
    'mon-5-b1',
    null,
    'CSE-15',
    'Monday',
    'Data Visualisation (Batch 1)',
    '25VA301',
    'Dr. Disha Mohini Pathak (DMP)',
    'KC-202',
    '13:10',
    '14:00',
    'Batch-1',
    'workshop',
    true
  ),

  (
    'mon-5-b2',
    null,
    'CSE-15',
    'Monday',
    'Data Visualisation (Batch 2)',
    '25VA301',
    'Dr. Somya Srivastava (SOS)',
    'KC-204',
    '13:10',
    '14:00',
    'Batch-2',
    'workshop',
    true
  ),

  (
    'mon-5-fcc',
    null,
    'CSE-15',
    'Monday',
    'Fundamentals of Cloud Computing',
    '25VA301',
    'Ms. Swati Sheron (SW)',
    'KC-205',
    '13:10',
    '14:00',
    'FCC',
    'lecture',
    true
  ),

  (
    'mon-6',
    null,
    'CSE-15',
    'Monday',
    'OOPS',
    '25CS301',
    'Mr. Dhaneshwar Kumar (DK)',
    'KC-204',
    '14:00',
    '14:50',
    null,
    'lecture',
    true
  ),

  (
    'mon-7',
    null,
    'CSE-15',
    'Monday',
    'Technical Communication',
    '25HU302',
    'Ms. Mokshi Juyal (MJ)',
    'KC-204',
    '14:50',
    '15:40',
    null,
    'lecture',
    true
  ),

  (
    'mon-8',
    null,
    'CSE-15',
    'Monday',
    'Advance Data Structure',
    '25CS303',
    'Ms. Pooja Singhal (PSG)',
    'KC-204',
    '15:40',
    '16:30',
    null,
    'lecture',
    true
  ),


  -- ============================================================================
  -- TUESDAY
  -- ============================================================================

  (
    'tue-1',
    null,
    'CSE-15',
    'Tuesday',
    'Advance Data Structure',
    '25CS303',
    'Ms. Pooja Singhal (PSG)',
    'KC-205',
    '08:50',
    '09:40',
    null,
    'lecture',
    true
  ),

  (
    'tue-2',
    null,
    'CSE-15',
    'Tuesday',
    'Technical Communication',
    '25HU302',
    'Ms. Mokshi Juyal (MJ)',
    'KC-205',
    '09:40',
    '10:30',
    null,
    'lecture',
    true
  ),

  (
    'tue-3',
    null,
    'CSE-15',
    'Tuesday',
    'FSD Workshop -1',
    '25VA351',
    'Ms. Laxmi Saraswat (LS)',
    'KC-205',
    '10:40',
    '11:30',
    null,
    'workshop',
    true
  ),

  (
    'tue-4',
    null,
    'CSE-15',
    'Tuesday',
    'FSD Workshop -1',
    '25VA351',
    'Ms. Laxmi Saraswat (LS)',
    'KC-205',
    '11:30',
    '12:20',
    null,
    'workshop',
    true
  ),

  (
    'tue-5-g2',
    null,
    'CSE-15',
    'Tuesday',
    'OS LAB',
    '25CS352',
    'Ms. Swati Sheron (SW)',
    'Lab-5',
    '13:10',
    '14:50',
    'G2',
    'lab',
    true
  ),

  (
    'tue-5-g1',
    null,
    'CSE-15',
    'Tuesday',
    'ADVANCED DATA STRUCTURES LAB',
    '25CS353',
    'Ms. Pooja Singhal (PSG)',
    'Lab-4',
    '13:10',
    '14:50',
    'G1',
    'lab',
    true
  ),

  (
    'tue-7',
    null,
    'CSE-15',
    'Tuesday',
    'Operating Systems',
    '25CS302',
    'Ms. Divya Maheswari (DM)',
    'KC-108',
    '14:50',
    '15:40',
    null,
    'lecture',
    true
  ),

  (
    'tue-8-b1',
    null,
    'CSE-15',
    'Tuesday',
    'Data Visualisation (Batch 1)',
    '25VA301',
    'Dr. Disha Mohini Pathak (DMP)',
    'KC-204',
    '15:40',
    '16:30',
    'Batch-1',
    'workshop',
    true
  ),

  (
    'tue-8-b2',
    null,
    'CSE-15',
    'Tuesday',
    'Data Visualisation (Batch 2)',
    '25VA301',
    'Dr. Somya Srivastava (SOS)',
    'KC-108',
    '15:40',
    '16:30',
    'Batch-2',
    'workshop',
    true
  ),

  (
    'tue-8-fcc',
    null,
    'CSE-15',
    'Tuesday',
    'Fundamentals of Cloud Computing',
    '25VA301',
    'Ms. Swati Sheron (SW)',
    'KC-207',
    '15:40',
    '16:30',
    'FCC',
    'lecture',
    true
  ),


  -- ============================================================================
  -- WEDNESDAY
  -- ============================================================================

  (
    'wed-1-b1',
    null,
    'CSE-15',
    'Wednesday',
    'Data Visualisation (Batch 1)',
    '25VA301',
    'Dr. Disha Mohini Pathak (DMP)',
    'KC-202',
    '08:50',
    '09:40',
    'Batch-1',
    'workshop',
    true
  ),

  (
    'wed-1-b2',
    null,
    'CSE-15',
    'Wednesday',
    'Data Visualisation (Batch 2)',
    '25VA301',
    'Dr. Somya Srivastava (SOS)',
    'KC-204',
    '08:50',
    '09:40',
    'Batch-2',
    'workshop',
    true
  ),

  (
    'wed-1-fcc',
    null,
    'CSE-15',
    'Wednesday',
    'Fundamentals of Cloud Computing',
    '25VA301',
    'Ms. Swati Sheron (SW)',
    'KC-205',
    '08:50',
    '09:40',
    'FCC',
    'lecture',
    true
  ),

  (
    'wed-2',
    null,
    'CSE-15',
    'Wednesday',
    'FSD Workshop -1',
    '25VA351',
    'Ms. Laxmi Saraswat (LS)',
    'KC-205',
    '09:40',
    '10:30',
    null,
    'workshop',
    true
  ),

  (
    'wed-3',
    null,
    'CSE-15',
    'Wednesday',
    'FSD Workshop -1',
    '25VA351',
    'Ms. Laxmi Saraswat (LS)',
    'KC-205',
    '10:40',
    '11:30',
    null,
    'workshop',
    true
  ),

  (
    'wed-4',
    null,
    'CSE-15',
    'Wednesday',
    'Technical Communication',
    '25HU302',
    'Ms. Mokshi Juyal (MJ)',
    'KC-205',
    '11:30',
    '12:20',
    null,
    'lecture',
    true
  ),

  (
    'wed-5',
    null,
    'CSE-15',
    'Wednesday',
    'DSTL',
    '25BOE 312',
    'Mr. Varun Kumar (VV)',
    'KC-205',
    '13:10',
    '14:00',
    null,
    'lecture',
    true
  ),

  (
    'wed-6',
    null,
    'CSE-15',
    'Wednesday',
    'Advance Data Structure',
    '25CS303',
    'Ms. Pooja Singhal (PSG)',
    'KC-205',
    '14:00',
    '14:50',
    null,
    'lecture',
    true
  ),

  (
    'wed-7',
    null,
    'CSE-15',
    'Wednesday',
    'OOPS',
    '25CS301',
    'Mr. Dhaneshwar Kumar (DK)',
    'KC-205',
    '14:50',
    '15:40',
    null,
    'lecture',
    true
  ),

  (
    'wed-8',
    null,
    'CSE-15',
    'Wednesday',
    'Holistic Skills & Innovation-3',
    '25VA352',
    'Ms. Astha Goyal (ASG), Ms. Swati Sheron (SW)',
    'KC-205',
    '15:40',
    '16:30',
    null,
    'skill',
    true
  ),


  -- ============================================================================
  -- THURSDAY
  -- ============================================================================

  (
    'thu-1',
    null,
    'CSE-15',
    'Thursday',
    'OOPS',
    '25CS301',
    'Mr. Dhaneshwar Kumar (DK)',
    'KC-204',
    '08:50',
    '09:40',
    null,
    'lecture',
    true
  ),

  (
    'thu-2',
    null,
    'CSE-15',
    'Thursday',
    'Advance Data Structure',
    '25CS303',
    'Ms. Pooja Singhal (PSG)',
    'KC-204',
    '09:40',
    '10:30',
    null,
    'lecture',
    true
  ),

  (
    'thu-3',
    null,
    'CSE-15',
    'Thursday',
    'DSTL',
    '25BOE 312',
    'Mr. Varun Kumar (VV)',
    'KC-204',
    '10:40',
    '11:30',
    null,
    'lecture',
    true
  ),

  (
    'thu-4',
    null,
    'CSE-15',
    'Thursday',
    'DSTL',
    '25BOE 312',
    'Mr. Varun Kumar (VV)',
    'KC-204',
    '11:30',
    '12:20',
    null,
    'lecture',
    true
  ),

  (
    'thu-5',
    null,
    'CSE-15',
    'Thursday',
    'Operating Systems',
    '25CS302',
    'Ms. Divya Maheswari (DM)',
    'KC-204',
    '13:10',
    '14:00',
    null,
    'lecture',
    true
  ),

  (
    'thu-6',
    null,
    'CSE-15',
    'Thursday',
    'Advance Data Structure',
    '25CS303',
    'Ms. Pooja Singhal (PSG)',
    'KC-204',
    '14:00',
    '14:50',
    null,
    'lecture',
    true
  ),

  (
    'thu-7',
    null,
    'CSE-15',
    'Thursday',
    'Employability Skills',
    '25VA309',
    'Ms. Mokshi Juyal (MJ)',
    'KC-204',
    '14:50',
    '16:30',
    null,
    'skill',
    true
  ),


  -- ============================================================================
  -- FRIDAY
  -- ============================================================================

  (
    'fri-1-g2',
    null,
    'CSE-15',
    'Friday',
    'ADVANCED DATA STRUCTURES LAB',
    '25CS353',
    'Ms. Pooja Singhal (PSG)',
    'Lab-5',
    '08:50',
    '10:30',
    'G2',
    'lab',
    true
  ),

  (
    'fri-1-g1',
    null,
    'CSE-15',
    'Friday',
    'OOPS WITH C++ LAB',
    '25CS351',
    'Mr. Dhaneshwar Kumar (DK)',
    'Lab-4',
    '08:50',
    '10:30',
    'G1',
    'lab',
    true
  ),

  (
    'fri-3',
    null,
    'CSE-15',
    'Friday',
    'Verbal Ability',
    'VA',
    'Dr. Abhrity Thakur (AT)',
    'KC-205',
    '10:40',
    '11:30',
    null,
    'skill',
    true
  ),

  (
    'fri-4',
    null,
    'CSE-15',
    'Friday',
    'OOPS',
    '25CS301',
    'Mr. Dhaneshwar Kumar (DK)',
    'KC-205',
    '11:30',
    '12:20',
    null,
    'lecture',
    true
  ),

  (
    'fri-5',
    null,
    'CSE-15',
    'Friday',
    'Operating Systems',
    '25CS302',
    'Ms. Divya Maheswari (DM)',
    'KC-205',
    '13:10',
    '14:00',
    null,
    'lecture',
    true
  ),

  (
    'fri-6',
    null,
    'CSE-15',
    'Friday',
    'Advance Data Structure',
    '25CS303',
    'Ms. Pooja Singhal (PSG)',
    'KC-205',
    '14:00',
    '14:50',
    null,
    'lecture',
    true
  ),

  (
    'fri-7',
    null,
    'CSE-15',
    'Friday',
    'DSTL',
    '25BOE 312',
    'Mr. Varun Kumar (VV)',
    'KC-205',
    '14:50',
    '15:40',
    null,
    'lecture',
    true
  ),

  (
    'fri-8-b1',
    null,
    'CSE-15',
    'Friday',
    'Data Visualisation (Batch 1)',
    '25VA301',
    'Dr. Disha Mohini Pathak (DMP)',
    'KC-204',
    '15:40',
    '16:30',
    'Batch-1',
    'workshop',
    true
  ),

  (
    'fri-8-b2',
    null,
    'CSE-15',
    'Friday',
    'Data Visualisation (Batch 2)',
    '25VA301',
    'Dr. Somya Srivastava (SOS)',
    'KC-205',
    '15:40',
    '16:30',
    'Batch-2',
    'workshop',
    true
  ),

  (
    'fri-8-fcc',
    null,
    'CSE-15',
    'Friday',
    'Fundamentals of Cloud Computing',
    '25VA301',
    'Ms. Swati Sheron (SW)',
    'KC-207',
    '15:40',
    '16:30',
    'FCC',
    'lecture',
    true
  )

on conflict (id) do update set
  subject = excluded.subject,
  course_code = excluded.course_code,
  teacher = excluded.teacher,
  room = excluded.room,
  start_time = excluded.start_time,
  end_time = excluded.end_time,
  batch = excluded.batch,
  type = excluded.type,
  is_official = true,
  updated_at = timezone('utc'::text, now());