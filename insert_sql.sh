#!/usr/bin/env bash
# insert_sql.sh - insert test rows directly into Postgres using psql environment variables.
# Requires: psql in PATH and PGHOST, PGUSER, PGPASSWORD, PGDATABASE set (or adjust the psql connection string in the script).
set -euo pipefail
SQL=$(cat <<'SQL'
INSERT INTO agent_modem_reports(agent_id, gateway, http, decision)
VALUES ('1','192.168.1.1','[{"url":"http://192.168.1.1/","status":200,"bodySnippet":"<title>Router</title>"}]'::jsonb,'{"compatibility":"compatible","reason":"TP-Link detected"}'::jsonb);

INSERT INTO agent_device_reports(agent_id, devices)
VALUES ('1','[{"ip":"192.168.1.45","mac":"AA:BB:CC:DD:EE:01","hostname":"Tablet-Juan","last_seen":"2025-10-07T23:24:31Z"}]'::jsonb);
SQL
)
echo "Running SQL to insert test reports..."
psql "${PGCONN:-}" -c "$SQL"
echo "Done."
