-- Estensioni utili
create extension if not exists pgcrypto;

-- ================
-- TENANCY & MEMBERS
-- ================
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('INDIVIDUAL','MSP')),
  name text not null,
  owner_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.tenant_members (
  tenant_id uuid references public.tenants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null check (role in ('OWNER','ADMIN','MEMBER')),
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

-- MSP customers (sub-tenants logici)
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

-- ================
-- BILLING
-- ================
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid unique not null references public.tenants(id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text not null,
  plan text not null check (plan in (
    'INDIVIDUAL_MONTHLY','INDIVIDUAL_YEARLY','MSP_MONTHLY','MSP_YEARLY'
  )),
  status text not null,
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

-- ================
-- FEED TOKENS & LOGS
-- ================
create table if not exists public.feed_tokens (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  type text not null check (type in ('ipv4','domains')),
  token text not null unique,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.feed_access_logs (
  id bigserial primary key,
  token text not null,
  kind text not null check (kind in ('ipv4','domain')),
  ip text,
  ua text,
  created_at timestamptz not null default now()
);

-- ================
-- INDICATORS (RAW/VALIDATED) & VALIDATION
-- ================
create table if not exists public.raw_indicators (
  id bigserial primary key,
  indicator text not null,
  kind text not null check (kind in ('ipv4','domain')),
  source text not null,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  unique (indicator, source)
);

create table if not exists public.vendor_checks (
  id bigserial primary key,
  indicator text not null,
  kind text not null check (kind in ('ipv4','domain')),
  vendor text not null check (vendor in ('abuseipdb','virustotal','neutrino')),
  score numeric,
  raw jsonb,
  checked_at timestamptz not null default now()
);

create table if not exists public.validated_indicators (
  indicator text primary key,
  kind text not null check (kind in ('ipv4','domain')),
  confidence numeric not null,
  country text,
  asn text,
  last_validated timestamptz not null default now()
);

create table if not exists public.validation_jobs (
  id bigserial primary key,
  indicator text not null,
  kind text not null check (kind in ('ipv4','domain')),
  status text not null default 'PENDING' check (status in ('PENDING','RUNNING','DONE','FAILED')),
  attempts int not null default 0,
  scheduled_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_deltas (
  id bigserial primary key,
  run_date date not null,
  kind text not null check (kind in ('ipv4','domain')),
  added int not null,
  removed int not null
);

-- ================
-- SUPPORT
-- ================
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id),
  user_id uuid references auth.users(id),
  subject text,
  message text,
  created_at timestamptz not null default now()
);

-- ================
-- TRIGGER updated_at per validation_jobs
-- ================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end$$;

drop trigger if exists trg_validation_jobs_updated on public.validation_jobs;
create trigger trg_validation_jobs_updated
before update on public.validation_jobs
for each row execute function public.set_updated_at();

-- ================
-- RLS POLICIES
-- ================

-- Abilita RLS
alter table public.tenants enable row level security;
alter table public.tenant_members enable row level security;
alter table public.customers enable row level security;
alter table public.subscriptions enable row level security;
alter table public.feed_tokens enable row level security;
alter table public.feed_access_logs enable row level security;
alter table public.support_tickets enable row level security;

-- Tabelle GLOBALI: abilita RLS ma NON creare policy (quindi nessun accesso client)
alter table public.raw_indicators enable row level security;
alter table public.vendor_checks enable row level security;
alter table public.validated_indicators enable row level security;
alter table public.validation_jobs enable row level security;
alter table public.daily_deltas enable row level security;

-- TENANTS
create policy tenants_select on public.tenants
for select using (
  exists (
    select 1 from public.tenant_members tm
    where tm.tenant_id = tenants.id and tm.user_id = auth.uid()
  )
);

create policy tenants_update on public.tenants
for update using (
  auth.uid() = owner_user_id
);

create policy tenants_insert on public.tenants
for insert with check ( true );

-- TENANT MEMBERS
create policy tenant_members_select on public.tenant_members
for select using (
  exists (
    select 1 from public.tenant_members tm2
    where tm2.tenant_id = tenant_members.tenant_id and tm2.user_id = auth.uid()
  )
);

create policy tenant_members_insert on public.tenant_members
for insert with check (
  exists (
    select 1 from public.tenant_members tm2
    where tm2.tenant_id = tenant_members.tenant_id and tm2.user_id = auth.uid()
  )
);

create policy tenant_members_update on public.tenant_members
for update using (
  exists (
    select 1 from public.tenant_members tm2
    where tm2.tenant_id = tenant_members.tenant_id and tm2.user_id = auth.uid()
  )
);

-- CUSTOMERS (MSP)
create policy customers_rw on public.customers
for all using (
  exists (
    select 1 from public.tenant_members tm
    where tm.tenant_id = customers.tenant_id and tm.user_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.tenant_members tm
    where tm.tenant_id = customers.tenant_id and tm.user_id = auth.uid()
  )
);

-- SUBSCRIPTIONS
create policy subscriptions_rw on public.subscriptions
for all using (
  exists (
    select 1 from public.tenant_members tm
    where tm.tenant_id = subscriptions.tenant_id and tm.user_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.tenant_members tm
    where tm.tenant_id = subscriptions.tenant_id and tm.user_id = auth.uid()
  )
);

-- FEED TOKENS
create policy feed_tokens_rw on public.feed_tokens
for all using (
  case
    when feed_tokens.customer_id is null then
      exists (select 1 from public.tenant_members tm
              where tm.tenant_id = feed_tokens.tenant_id and tm.user_id = auth.uid())
    else
      exists (select 1 from public.customers c
                join public.tenant_members tm on tm.tenant_id = c.tenant_id
              where c.id = feed_tokens.customer_id and tm.user_id = auth.uid())
  end
) with check (
  case
    when feed_tokens.customer_id is null then
      exists (select 1 from public.tenant_members tm
              where tm.tenant_id = feed_tokens.tenant_id and tm.user_id = auth.uid())
    else
      exists (select 1 from public.customers c
                join public.tenant_members tm on tm.tenant_id = c.tenant_id
              where c.id = feed_tokens.customer_id and tm.user_id = auth.uid())
  end
);

-- FEED ACCESS LOGS
create policy feed_access_logs_select on public.feed_access_logs
for select using (
  exists (
    select 1 from public.feed_tokens ft
      join public.tenant_members tm on tm.tenant_id = ft.tenant_id
    where ft.token = feed_access_logs.token
      and tm.user_id = auth.uid()
  )
);

-- SUPPORT TICKETS
create policy support_tickets_rw on public.support_tickets
for all using (
  (support_tickets.user_id = auth.uid())
  or exists (
    select 1 from public.tenant_members tm
    where tm.tenant_id = support_tickets.tenant_id and tm.user_id = auth.uid()
  )
) with check (
  (support_tickets.user_id = auth.uid())
  or exists (
    select 1 from public.tenant_members tm
    where tm.tenant_id = support_tickets.tenant_id and tm.user_id = auth.uid()
  )
);