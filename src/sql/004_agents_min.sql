-- 004_agents_min.sql
-- Idempotent: crea tablas mínimas si no existen

create table if not exists homes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text default 'Home',
  created_at timestamptz default now()
);

create table if not exists agents (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references homes(id) on delete cascade,
  api_token text not null unique,
  created_at timestamptz default now()
);

create table if not exists agent_reports (
  id bigserial primary key,
  home_id uuid not null references homes(id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz default now()
);
