-- ─── Recruitment Firebase Credentials ───────────────────────────────────────
-- Stores the Firebase config used by the Recruitment module.
-- Only one active row at a time (enforced by the unique constraint on is_active).
-- Run this in your Supabase SQL editor.

create table if not exists public.recruitment_credentials (
  id              uuid primary key default gen_random_uuid(),

  -- Firebase project config
  api_key         text not null,
  auth_domain     text not null,
  project_id      text not null,
  storage_bucket  text,
  messaging_sender_id text,
  app_id          text,
  measurement_id  text,

  -- Which Firestore collection to use for job postings
  collection_name text not null default 'careers',

  -- Label / notes
  label           text default 'Default',
  is_active       boolean default true,

  -- Timestamps
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Auto-update updated_at
create or replace function public.set_recruitment_creds_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_recruitment_creds_updated_at on public.recruitment_credentials;
create trigger trg_recruitment_creds_updated_at
  before update on public.recruitment_credentials
  for each row execute function public.set_recruitment_creds_updated_at();
