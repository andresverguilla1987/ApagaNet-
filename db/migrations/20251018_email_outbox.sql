-- db/migrations/20251018_email_outbox.sql
-- Email Outbox + Dedupe + Retry (PostgreSQL)
-- If you don't have pgcrypto, enable it (needs superuser on some providers)
-- CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS email_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_address TEXT NOT NULL,
  subject TEXT NOT NULL,
  html TEXT,
  text TEXT,
  template TEXT,
  payload JSONB,
  dedupe_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending|sending|sent|failed
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  retry_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_email_outbox_dedupe ON email_outbox (dedupe_key);
CREATE INDEX IF NOT EXISTS ix_email_outbox_pending ON email_outbox (status, retry_at NULLS FIRST, created_at);
