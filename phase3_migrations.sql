-- phase3_migrations.sql
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('email','webhook')),
  target text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists alerts (
  id uuid primary key default gen_random_uuid(),
  level text not null default 'info',
  title text not null,
  message text,
  created_at timestamptz not null default now()
);
