-- scripts/migrate_phase1.sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Usuarios
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Alertas (v2)
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  TEXT NULL,
  home_id  TEXT NULL,
  device_id TEXT NULL,
  level TEXT NOT NULL CHECK (level IN ('info','warn','critical')),
  title TEXT NOT NULL,
  message TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at    ON alerts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_home_created  ON alerts (home_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_device_created ON alerts (device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_metadata_gin  ON alerts USING GIN (metadata);

-- Suscripciones (email / webhook)
CREATE TABLE IF NOT EXISTS alert_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('webhook','email')),
  endpoint_url TEXT NULL,
  email TEXT NULL,
  user_id TEXT NULL,
  home_id TEXT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_alert_sub_email_home
  ON alert_subscriptions (home_id, LOWER(email))
  WHERE type='email';
CREATE UNIQUE INDEX IF NOT EXISTS uq_alert_sub_webhook_home
  ON alert_subscriptions (home_id, endpoint_url)
  WHERE type='webhook';
