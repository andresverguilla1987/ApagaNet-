-- schema.sql — Tablas mínimas para persistencia
CREATE TABLE IF NOT EXISTS homes (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  home_id TEXT NOT NULL,
  name TEXT,
  online BOOLEAN DEFAULT true,
  last_seen TIMESTAMP DEFAULT NOW(),
  paused_until TIMESTAMP DEFAULT NULL,
  notify_home_enter BOOLEAN DEFAULT true,
  notify_home_exit BOOLEAN DEFAULT true,
  CONSTRAINT fk_home FOREIGN KEY (home_id) REFERENCES homes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS geofences (
  id TEXT PRIMARY KEY,
  home_id TEXT NOT NULL,
  name TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  radius_meters INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_home_gf FOREIGN KEY (home_id) REFERENCES homes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  home_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  at TIMESTAMP NOT NULL,
  CONSTRAINT fk_device FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_locations_device_time ON locations(device_id, at);

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  home_id TEXT NOT NULL,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  read BOOLEAN DEFAULT false,
  CONSTRAINT fk_home_alert FOREIGN KEY (home_id) REFERENCES homes(id) ON DELETE CASCADE
);

-- Geofence state for hysteresis
CREATE TABLE IF NOT EXISTS geofence_state (
  device_id TEXT PRIMARY KEY,
  fence_id TEXT,
  inside BOOLEAN,
  counter INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);
