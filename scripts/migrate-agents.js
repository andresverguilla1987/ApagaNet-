// scripts/migrate.js
import { pool } from "../src/lib/db.js";

const SQL = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ====== ALERTS ======
CREATE TABLE IF NOT EXISTS alerts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT,
  home_id    TEXT,
  device_id  TEXT,
  level      TEXT NOT NULL CHECK (level IN ('info','warn','critical')),
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  metadata   JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at    ON alerts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_home_created  ON alerts (home_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_device_created ON alerts (device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_metadata_gin  ON alerts USING GIN (metadata);

-- ====== SUBSCRIPTIONS (email/webhook) ======
CREATE TABLE IF NOT EXISTS alert_subscriptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type         TEXT NOT NULL CHECK (type IN ('webhook','email')),
  endpoint_url TEXT,          -- para type=webhook
  email        TEXT,          -- para type=email
  user_id      TEXT,
  home_id      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_alert_subs_home ON alert_subscriptions(home_id, created_at DESC);

-- ====== OUTBOX (pendientes por enviar) ======
CREATE TABLE IF NOT EXISTS notifications_outbox (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id     UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  sub_id       UUID NOT NULL REFERENCES alert_subscriptions(id) ON DELETE CASCADE,
  try_count    INT NOT NULL DEFAULT 0,
  last_error   TEXT,
  status       TEXT NOT NULL DEFAULT 'pending', -- pending/sent/failed
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_outbox_status_created ON notifications_outbox(status, created_at DESC);
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
