-- src/migrations/003_agents_and_actions.sql — DO NOT TRANSLATE

create table if not exists homes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  name text,
  created_at timestamptz default now()
);

create table if not exists agents (
  id uuid primary key default gen_random_uuid(),
  home_id uuid references homes(id) on delete cascade,
  api_token text not null,
  created_at timestamptz default now()
);

create table if not exists actions (
  id uuid primary key default gen_random_uuid(),
  home_id uuid references homes(id) on delete cascade,
  device_id uuid references devices(id) on delete cascade,
  mac text not null,
  type text not null check (type in ('block','unblock')),
  status text not null default 'pending',
  error text,
  created_at timestamptz default now(),
  processed_at timestamptz
);

create index if not exists idx_actions_home_status on actions(home_id, status);
