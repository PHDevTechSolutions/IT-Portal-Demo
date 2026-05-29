-- ─── Leads table ─────────────────────────────────────────────────────────────
-- Separate from accounts — stores discovered prospects from Leads Generation.
-- Run this in your Supabase SQL editor.

create table if not exists public.leads (
  id                       uuid primary key default gen_random_uuid(),

  -- Company info
  company_name             text not null,
  contact_person           text,
  contact_number           text,
  email_address            text,
  address                  text,
  website                  text,
  industry                 text,
  region                   text,

  -- Discovery metadata
  source                   text,                  -- e.g. "businesslist.ph", "google.com", "AI Generated"
  search_query             text,                  -- the query used to find this lead
  search_mode              text,                  -- "web" | "ai" | "playwright"
  confidence               text default 'low'     -- "high" | "medium" | "low"
    check (confidence in ('high', 'medium', 'low')),

  -- Lead status / pipeline
  status                   text default 'New'
    check (status in ('New', 'Contacted', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost', 'Unqualified')),

  -- Assignment
  assigned_to              text,                  -- agent/user name
  remarks                  text,

  -- Email tracking
  last_email_status        text,                  -- latest Resend webhook status
  last_emailed_at          timestamptz,

  -- Timestamps
  date_created             timestamptz default now(),
  date_updated             timestamptz default now()
);

-- Indexes
create index if not exists idx_leads_company_name   on public.leads(company_name);
create index if not exists idx_leads_email          on public.leads(email_address);
create index if not exists idx_leads_status         on public.leads(status);
create index if not exists idx_leads_industry       on public.leads(industry);
create index if not exists idx_leads_source         on public.leads(source);
create index if not exists idx_leads_date_created   on public.leads(date_created desc);

-- Auto-update date_updated
create or replace function public.set_leads_updated_at()
returns trigger language plpgsql as $$
begin
  new.date_updated = now();
  return new;
end;
$$;

drop trigger if exists trg_leads_updated_at on public.leads;
create trigger trg_leads_updated_at
  before update on public.leads
  for each row execute function public.set_leads_updated_at();
