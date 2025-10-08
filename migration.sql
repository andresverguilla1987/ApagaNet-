-- migration.sql (recomendado)
-- crea extensión necesaria para gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- tabla de reportes de módem (compatibilidad)
CREATE TABLE IF NOT EXISTS agent_modem_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id text NOT NULL,
  gateway text,
  http jsonb,
  decision jsonb,
  created_at timestamptz DEFAULT now()
);

-- tabla de reportes de dispositivos
CREATE TABLE IF NOT EXISTS agent_device_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id text NOT NULL,
  devices jsonb,
  created_at timestamptz DEFAULT now()
);

-- tabla opcional para comandos a agentes
CREATE TABLE IF NOT EXISTS agent_commands (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id text NULL,
  payload jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  delivered boolean DEFAULT false,
  delivered_at timestamptz NULL
);

-- índices para consultas por agent_id
CREATE INDEX IF NOT EXISTS idx_agent_modem_reports_agent ON agent_modem_reports(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_device_reports_agent ON agent_device_reports(agent_id);
