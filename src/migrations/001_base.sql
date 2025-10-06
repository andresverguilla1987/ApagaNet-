-- 001_base.sql
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text,
  plan text default 'free',
  trial_ends_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  name text not null,
  mac text not null,
  vendor text,
  blocked boolean default false,
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);
create index if not exists idx_devices_user on devices(user_id);

create table if not exists schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  device_id uuid references devices(id) on delete cascade,
  block_from time not null,
  block_to time not null,
  days int[] not null default '{1,2,3,4,5,6,7}',
  active boolean default true,
  created_at timestamptz default now()
);
create index if not exists idx_schedules_user on schedules(user_id);
create index if not exists idx_schedules_device on schedules(device_id);

create table if not exists schedule_runs (
  id bigserial primary key,
  ran_at timestamptz not null default now(),
  checked int not null,
  set_blocked int not null,
  set_unblocked int not null
);
