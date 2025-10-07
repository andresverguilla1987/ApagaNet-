create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text,
  created_at timestamptz default now()
);
create table if not exists homes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);
create table if not exists agents (
  id uuid primary key default gen_random_uuid(),
  home_id uuid references homes(id) on delete cascade,
  api_token text not null unique,
  created_at timestamptz default now()
);
create table if not exists devices (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mac text not null,
  blocked boolean default false,
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);
create table if not exists schedules (
  id uuid primary key default gen_random_uuid(),
  device_id uuid references devices(id) on delete cascade,
  block_from time not null,
  block_to time not null,
  days int[] default '{1,2,3,4,5,6,7}',
  active boolean default true,
  created_at timestamptz default now()
);
create table if not exists schedule_runs (
  id bigserial primary key,
  ran_at timestamptz not null,
  checked int not null,
  set_blocked int not null,
  set_unblocked int not null
);
