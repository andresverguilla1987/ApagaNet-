
-- db/migrations/20251018_notifications.sql
CREATE TABLE IF NOT EXISTS notification_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  channel TEXT NOT NULL,
  address TEXT NOT NULL,
  levels TEXT[] NOT NULL DEFAULT ARRAY['critical'],
  quiet_from TIME,
  quiet_to TIME,
  tz TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_subs_user_channel_addr
  ON notification_subscriptions (COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid), channel, address);
CREATE INDEX IF NOT EXISTS ix_subs_channel ON notification_subscriptions (channel);
