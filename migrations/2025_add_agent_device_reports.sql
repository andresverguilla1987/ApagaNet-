-- migrations/2025_add_agent_device_reports.sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS agent_device_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id text,
  devices jsonb,
  ts timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_device_reports_agent_idx ON agent_device_reports (agent_id);
