// scripts/migrate.js
import { pool } from "../src/lib/db.js";

const SQL = `
-- Users
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reports (for modem-compat logs)
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  agent_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Decisions (pause/resume)
CREATE TABLE IF NOT EXISTS decisions (
  id TEXT PRIMARY KEY,
  agent_id TEXT,
  device_id TEXT,
  action TEXT,
  minutes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Locations
CREATE TABLE IF NOT EXISTS locations (
  device_id TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  ts TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_locations_device_ts ON locations(device_id, ts DESC);

-- Trips
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

-- Trip points
CREATE TABLE IF NOT EXISTS trip_points (
  id BIGSERIAL PRIMARY KEY,
  trip_id BIGINT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  ts TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trip_points_trip_ts ON trip_points(trip_id, ts);

-- Tamper reports
CREATE TABLE IF NOT EXISTS tamper_reports (
  id BIGSERIAL PRIMARY KEY,
  device_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  details JSONB,
  ts TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- App rules
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

-- Alerts
CREATE TABLE IF NOT EXISTS alerts (
  id BIGSERIAL PRIMARY KEY,
  device_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'generic',
  message TEXT NOT NULL DEFAULT '',
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

async function main() {
  console.log("Running migrations...");
  await pool.query("BEGIN");
  try {
    await pool.query(SQL);
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
