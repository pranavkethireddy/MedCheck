-- MedCheck Supabase schema
-- Run this in the Supabase project's SQL editor (or via `supabase db push`
-- if using the CLI) once the project is created.
--
-- `auth.users` is managed automatically by Supabase Auth — nothing to
-- create for that.

create extension if not exists pgcrypto;

create table if not exists medications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  name text not null,
  rxcui text not null,
  time_of_day text, -- e.g. "08:00", used for the timeline/schedule wow layer
  created_at timestamptz default now()
);

create table if not exists interaction_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  drug_a text not null,
  drug_b text not null,
  severity text not null, -- 'none' | 'minor' | 'significant'
  raw_description text,
  plain_explanation text,
  created_at timestamptz default now()
);

-- Caches one Backboard "assistant" id per user (app/backboard_client.py),
-- so we create at most one assistant per user instead of one per request.
-- Not user-facing data — service-role key only, no RLS needed to protect
-- anything sensitive here (just an opaque third-party id).
create table if not exists user_memory (
  user_id uuid primary key references auth.users(id),
  backboard_assistant_id text not null,
  created_at timestamptz default now()
);

-- Caregiver linking (app/main.py's /api/caregiver/* endpoints), replacing
-- the hardcoded MOCK_CODE_DIRECTORY that used to live in
-- frontend/src/CaregiverMode.jsx.
--
-- caregiver_access_codes: one stable, shareable code per patient, created
-- lazily on first call to /api/caregiver/my-code.
create table if not exists caregiver_access_codes (
  user_id uuid primary key references auth.users(id),
  code text unique not null,
  display_name text,
  created_at timestamptz default now()
);

-- caregiver_links: created when a caregiver redeems a patient's code. This
-- is the real security boundary — /api/caregiver/patient-medications
-- refuses to return anything unless a row here proves the link exists.
create table if not exists caregiver_links (
  id uuid primary key default gen_random_uuid(),
  caregiver_user_id uuid references auth.users(id) not null,
  patient_user_id uuid references auth.users(id) not null,
  created_at timestamptz default now(),
  unique (caregiver_user_id, patient_user_id)
);

-- Caregiver-side "was this actually taken" log (app/main.py's
-- /api/caregiver/log-medication-taken + /api/caregiver/medication-log).
-- Deliberately caregiver-only — a caregiver recording what they observed,
-- not a patient's own self-tracking. Stores medication_name as plain text
-- (not a foreign key to medications.id) since a caregiver may log a dose
-- for a medication the patient later edits or removes; the log should
-- stay a stable historical record either way.
create table if not exists medication_dose_logs (
  id uuid primary key default gen_random_uuid(),
  patient_user_id uuid references auth.users(id) not null,
  caregiver_user_id uuid references auth.users(id) not null,
  medication_name text not null,
  taken_at timestamptz not null default now(),
  created_at timestamptz default now()
);

create index if not exists medications_user_id_idx on medications(user_id);
create index if not exists interaction_flags_user_id_idx on interaction_flags(user_id);
create index if not exists caregiver_links_caregiver_idx on caregiver_links(caregiver_user_id);
create index if not exists caregiver_links_patient_idx on caregiver_links(patient_user_id);
create index if not exists medication_dose_logs_patient_idx on medication_dose_logs(patient_user_id);

-- Row Level Security ------------------------------------------------------
-- Our serverless functions currently use the SERVICE ROLE key, which
-- bypasses RLS entirely — so these policies aren't load-bearing for the
-- backend today. They're here so that:
--   (a) if the frontend ever queries Supabase directly with the anon key
--       + a logged-in user's session, it can only see its own rows, and
--   (b) turning on RLS doesn't silently break anything later.
--
-- Enable RLS:
alter table medications enable row level security;
alter table interaction_flags enable row level security;
alter table caregiver_access_codes enable row level security;
alter table caregiver_links enable row level security;
alter table medication_dose_logs enable row level security;

-- Users can only see/modify their own rows:
create policy "Users can view their own medications"
  on medications for select
  using (auth.uid() = user_id);

create policy "Users can insert their own medications"
  on medications for insert
  with check (auth.uid() = user_id);

create policy "Users can view their own interaction flags"
  on interaction_flags for select
  using (auth.uid() = user_id);

create policy "Users can insert their own interaction flags"
  on interaction_flags for insert
  with check (auth.uid() = user_id);

create policy "Users can view their own access code"
  on caregiver_access_codes for select
  using (auth.uid() = user_id);

create policy "Caregivers and patients can view their own links"
  on caregiver_links for select
  using (auth.uid() = caregiver_user_id or auth.uid() = patient_user_id);

create policy "Caregivers and patients can view dose logs"
  on medication_dose_logs for select
  using (auth.uid() = caregiver_user_id or auth.uid() = patient_user_id);
