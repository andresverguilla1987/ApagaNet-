-- migration: create minimal agent report tables if they don't exist
CREATE TABLE IF NOT EXISTS agent_modem_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id text NOT NULL,
  gateway text,
  http jsonb,
  decision jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_device_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id text NOT NULL,
  devices jsonb,
  created_at timestamptz DEFAULT now()
);

-- optional helper: agent_commands
CREATE TABLE IF NOT EXISTS agent_commands (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id text NULL,
  payload jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  delivered boolean DEFAULT false,
  delivered_at timestamptz NULL
);
