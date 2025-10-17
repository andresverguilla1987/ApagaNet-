-- ApagaNet Alerts table
-- Safe UUID support
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NULL,
  home_id TEXT NULL,
  device_id TEXT NULL,
  level TEXT NOT NULL CHECK (level IN ('info','warn','critical')),
  title TEXT NOT NULL,
  message TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_by TEXT NULL
);

-- Useful indexes
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_user_unread ON alerts (user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_alerts_home_created ON alerts (home_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_device_created ON alerts (device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_metadata_gin ON alerts USING GIN (metadata);

COMMENT ON TABLE alerts IS 'ApagaNet alerts: events, warnings and critical notices';
