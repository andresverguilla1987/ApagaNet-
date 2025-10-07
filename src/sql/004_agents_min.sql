-- Homes y Agents mínimos
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

-- Para acciones pendientes (opcional si ya la tienes)
create table if not exists actions (
  id bigserial primary key,
  home_id uuid not null references homes(id) on delete cascade,
  action jsonb not null,
  created_at timestamptz default now()
);

create index if not exists idx_agents_home on agents(home_id);
create index if not exists idx_actions_home on actions(home_id);
