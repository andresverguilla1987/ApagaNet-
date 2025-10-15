CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS locations (
  id BIGSERIAL PRIMARY KEY,
  device_id TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  ts TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trips (
  id BIGSERIAL PRIMARY KEY,
  device_id TEXT NOT NULL,
  start_ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_ts TIMESTAMPTZ,
  start_lat DOUBLE PRECISION,
  start_lon DOUBLE PRECISION,
  end_lat DOUBLE PRECISION,
  end_lon DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trip_points (
  id BIGSERIAL PRIMARY KEY,
  trip_id BIGINT REFERENCES trips(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  ts TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tamper_reports (
  id BIGSERIAL PRIMARY KEY,
  device_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  details JSONB,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_rules (
  id BIGSERIAL PRIMARY KEY,
  device_id TEXT NOT NULL,
  package_name TEXT,
  blocked BOOLEAN DEFAULT false,
  start_minute INTEGER,
  end_minute INTEGER,
  days_mask INTEGER DEFAULT 127,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_locations_device_ts ON locations(device_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_trips_device_start ON trips(device_id, start_ts DESC);
CREATE INDEX IF NOT EXISTS idx_tamper_device_ts ON tamper_reports(device_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_rules_device_pkg ON app_rules(device_id, package_name);
