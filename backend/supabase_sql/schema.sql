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

create index if not exists medications_user_id_idx on medications(user_id);
create index if not exists interaction_flags_user_id_idx on interaction_flags(user_id);

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
