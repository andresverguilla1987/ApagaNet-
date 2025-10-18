// scripts/migrate.js
// Migración consolidada: base + alerts v2 (UUID) + alert_subscriptions + alert_outbox
import { pool } from "../src/lib/db.js";

const BASE_SQL = `
-- ========= BASE EXISTENTE =========
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  agent_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS decisions (
  id TEXT PRIMARY KEY,
  agent_id TEXT,
  device_id TEXT,
  action TEXT,
  minutes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS locations (
  device_id TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  ts TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_locations_device_ts ON locations(device_id, ts DESC);

CREATE TABLE IF NOT EXISTS trips (
  id BIGSERIAL PRIMARY KEY,
  device_id TEXT NOT NULL,
  start_ts TIMESTAMPTZ,
  end_ts TIMESTAMPTZ,
  start_lat DOUBLE PRECISION,
  start_lon DOUBLE PRECISION,
  end_lat DOUBLE PRECISION,
  end_lon DOUBLE PRECISION
);

CREATE TABLE IF NOT EXISTS trip_points (
  id BIGSERIAL PRIMARY KEY,
  trip_id BIGINT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  ts TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trip_points_trip_ts ON trip_points(trip_id, ts);

CREATE TABLE IF NOT EXISTS tamper_reports (
  id BIGSERIAL PRIMARY KEY,
  device_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  details JSONB,
  ts TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_rules (
  id BIGSERIAL PRIMARY KEY,
  device_id TEXT NOT NULL,
  package_name TEXT NOT NULL,
  blocked BOOLEAN NOT NULL,
  start_minute INTEGER,
  end_minute INTEGER,
  days_mask INTEGER
);
CREATE INDEX IF NOT EXISTS idx_app_rules_device_pkg ON app_rules(device_id, package_name);
`;

const ENABLE_EXT = `
-- Necesario para gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;
`;

const ENSURE_ALERTS_V2 = `
-- Si existe alerts pero NO es el esquema nuevo (UUID + level/title/message/metadata),
-- la renombramos a alerts_legacy y creamos la nueva.
DO $$
DECLARE
  has_table BOOLEAN;
  is_v2 BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name='alerts' AND table_schema='public'
  ) INTO has_table;

  IF has_table THEN
    -- Consideramos "v2" si existe columna 'level' y la columna 'id' es de tipo uuid
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name='alerts' AND column_name='level'
    )
    AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name='alerts' AND column_name='id' AND data_type='uuid'
    )
    INTO is_v2;

    IF NOT is_v2 THEN
      -- Mantener datos viejos renombrando
      PERFORM 1;
      EXECUTE 'ALTER TABLE public.alerts RENAME TO alerts_legacy';
    END IF;
  END IF;

  -- Si no existe alerts (o la acabamos de renombrar), crear la nueva v2
  IF NOT has_table OR NOT is_v2 THEN
    EXECUTE $CT$
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
      CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts (created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_alerts_home_created ON alerts (home_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_alerts_device_created ON alerts (device_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_alerts_metadata_gin ON alerts USING GIN (metadata);
    $CT$;
  END IF;
END $$;
`;

const SUBS_OUTBOX = `
-- Suscripciones y outbox (para webhooks y correo)
CREATE TABLE IF NOT EXISTS alert_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('webhook','email')),
  endpoint_url TEXT NULL,
  email TEXT NULL,
  user_id TEXT NULL,
  home_id TEXT NULL,
  device_id TEXT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS alert_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES alert_subscriptions(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent')),
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_alert_outbox_status_created ON alert_outbox (status, created_at);
`;

async function main() {
  console.log("Running consolidated migrations…");
  await pool.query("BEGIN");
  try {
    await pool.query(BASE_SQL);
    await pool.query(ENABLE_EXT);
    await pool.query(ENSURE_ALERTS_V2);
    await pool.query(SUBS_OUTBOX);
    await pool.query("COMMIT");
    console.log("Migrations applied ✅");
  } catch (e) {
    await pool.query("ROLLBACK");
    console.error("Migration failed ❌", e);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
