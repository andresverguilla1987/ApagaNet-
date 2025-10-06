-- 002_device_block_state.sql — columnas de estado y auditoría
alter table devices
  add column if not exists blocked boolean default false,
  add column if not exists updated_at timestamptz default now();

create table if not exists schedule_runs (
  id bigserial primary key,
  ran_at timestamptz not null default now(),
  checked int not null,
  set_blocked int not null,
  set_unblocked int not null
);
