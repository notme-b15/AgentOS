-- AgentOS core tables. Money is integer paise (Rs 3,000 = 300000).

create table agents (
  id text primary key,
  name text not null,
  owner text not null,
  status text not null default 'active' check (status in ('active','revoked')),
  token_version int not null default 1,   -- bump to invalidate older passports
  created_at timestamptz not null default now()
);

-- Record of what was issued. The signed TOKEN is what the gateway enforces.
create table policies (
  agent_id text primary key references agents(id) on delete cascade,
  scopes text[] not null,
  max_per_txn bigint not null,
  daily_budget bigint not null,
  approval_threshold bigint not null,
  updated_at timestamptz not null default now()
);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null references agents(id),
  amount bigint not null,
  merchant text,
  status text not null check (status in ('approved','pending_approval','denied')),
  reason text,
  created_at timestamptz not null default now()
);
create index transactions_agent_day on transactions (agent_id, created_at);

create table approvals (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null references agents(id),
  action text not null,
  params jsonb not null,
  amount bigint,
  status text not null default 'pending' check (status in ('pending','approved','denied')),
  decided_by uuid references auth.users(id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create table audit_log (
  id bigint generated always as identity primary key,
  agent_id text,
  action text not null,
  decision text not null check (decision in ('allowed','blocked','pending')),
  reason text,
  payload jsonb,
  created_at timestamptz not null default now(),
  prev_hash text not null,
  hash text not null
);
