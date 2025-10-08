-- migrations/2025_add_agent_reports_and_blocks.sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Agent modem reports
CREATE TABLE IF NOT EXISTS agent_modem_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id text,
  gateway text,
  nmap jsonb,
  http jsonb,
  ssdp jsonb,
  decision jsonb,
  ts timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_modem_reports_agent_idx ON agent_modem_reports (agent_id);

-- Agent commands queue (for publishToAgentQueue)
CREATE TABLE IF NOT EXISTS agent_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id text,
  payload jsonb,
  delivered boolean DEFAULT false,
  delivered_at timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_commands_agent_idx ON agent_commands (agent_id);

-- Actions & history for device blocking
CREATE TABLE IF NOT EXISTS device_block_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  agent_id text,
  device_ids text[],
  macs text[],
  dry_run boolean DEFAULT false,
  reason text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS device_block_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid,
  mac text,
  action text, -- 'block' | 'unblock'
  source text,
  actor_id uuid,
  created_at timestamptz DEFAULT now()
);

-- Extend devices if missing columns (safe: IF NOT EXISTS)
ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS last_seen_ip text,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS owner_email text,
  ADD COLUMN IF NOT EXISTS last_agent_id text;
