-- Stock module Firebase credentials
create table if not exists public.stock_firebase_credentials (
  id                  uuid primary key default gen_random_uuid(),
  api_key             text not null,
  auth_domain         text not null,
  project_id          text not null,
  storage_bucket      text,
  messaging_sender_id text,
  app_id              text,
  collection_name     text not null default 'suppliers',
  label               text default 'Default',
  is_active           boolean default true,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create or replace function public.set_stock_creds_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_stock_creds_updated_at on public.stock_firebase_credentials;
create trigger trg_stock_creds_updated_at
  before update on public.stock_firebase_credentials
  for each row execute function public.set_stock_creds_updated_at();
