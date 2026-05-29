-- ─── Communications table ────────────────────────────────────────────────────
-- Stores every email thread tied to a lead/prospect/company.
-- Run this in your Supabase SQL editor.

create table if not exists public.communications (
  id                  uuid primary key default gen_random_uuid(),

  -- Who this email is about
  company_name        text,
  contact_person      text,
  email_address       text not null,         -- recipient / sender

  -- Thread grouping (all emails with same thread_id are one conversation)
  thread_id           text,                  -- set by sender; replies share same thread_id

  -- Direction
  direction           text not null check (direction in ('outbound', 'inbound')),

  -- Email content
  subject             text not null,
  body_html           text,
  body_text           text,

  -- Resend metadata
  resend_email_id     text,                  -- returned by Resend after send
  from_address        text,                  -- who sent it
  reply_to            text,                  -- reply-to header

  -- Status
  status              text default 'sent' check (status in ('sent', 'delivered', 'failed', 'received')),

  -- Linked to leads / customer database
  lead_source         text default 'leads-generation',  -- where the lead came from
  account_ref         text,                  -- account_reference_number if imported

  -- Sender info (the ERP user who sent it)
  sent_by_name        text,
  sent_by_email       text,

  -- Timestamps
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- Index for fast thread lookups
create index if not exists idx_communications_thread_id    on public.communications(thread_id);
create index if not exists idx_communications_email        on public.communications(email_address);
create index if not exists idx_communications_company      on public.communications(company_name);
create index if not exists idx_communications_created_at   on public.communications(created_at desc);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_communications_updated_at on public.communications;
create trigger trg_communications_updated_at
  before update on public.communications
  for each row execute function public.set_updated_at();
