-- scripts/migrations/011_alert_rules.sql
create table if not exists alert_rules (
  id text primary key,
  device_id text not null,
  name text not null,
  on_event text not null default 'both',
  channel text not null default 'email',
  email_to text null,
  webhook_url text null,
  webhook_secret text null,
  fence_ids jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_alert_rules_device on alert_rules(device_id);
