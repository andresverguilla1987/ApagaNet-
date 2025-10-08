APAGANET PATCH PACKAGE
======================

Files included:
- patched_server.js        -> server.js patched with admin/agent helpers and mounting for blocks routes
- src/routes/blocks.js     -> new ESM route module (agent reports, preview, apply)
- migrations/2025_add_agent_reports_and_blocks.sql  -> SQL migration to add tables

WHAT TO DO
1) Back up your repo and current server.js.
2) Replace your existing server.js with patched_server.js (or manually merge the additions).
   - The patched_server.js is based on your original server.js with added imports,
     authenticateAdmin/authenticateAgent/publishToAgentQueue and mounting the new routes.
   - If you prefer to manually integrate, copy the functions and the blocksRoutes(...) mount.

3) Copy src/routes/blocks.js into your project at src/routes/blocks.js

4) Apply DB migration to your Postgres database (psql or your migration tool):
   psql -h $PGHOST -U $PGUSER -d $PGDATABASE -f migrations/2025_add_agent_reports_and_blocks.sql

5) Restart your node server (pm2, systemd, or just `node server.js`).

TESTING
- Simulate an agent report:
  curl -X POST "http://localhost:10000/agents/report-modem-compat" \\
    -H "Authorization: Bearer <AGENT_TOKEN>" -H "Content-Type: application/json" \\
    -d '{"agent_id":"house-1","gateway":"192.168.1.1","http":[{"url":"http://192.168.1.1/","status":200,"bodySnippet":"<title>TP-Link</title>"}],"decision":{"compatibility":"compatible","reason":"TP-Link"}}'

- Preview blocks (admin token required):
  curl -H "Authorization: Bearer <ADMIN_JWT>" "http://localhost:10000/devices/preview-blocks?include_schedules=true"

- Apply blocks (dry-run):
  curl -X POST "http://localhost:10000/devices/apply-blocks" \\
    -H "Authorization: Bearer <ADMIN_JWT>" -H "Content-Type: application/json" \\
    -d '{"device_ids":["<id1>","<id2>"], "dry_run": true, "reason": "test"}'

NOTES & ADAPTATION
- The schedule logic in preview-blocks is a placeholder; replace the WHERE clause
  with your actual schedule active-now detection logic or expand to target groups/tags.
- publishToAgentQueue writes to agent_commands table; implement an agent poll endpoint
  (e.g., GET /agents/commands) that returns undelivered commands and marks them delivered.
- authenticateAdmin assumes JWT contains role='admin' or your ADMIN_IDS env var contains allowed user ids.
- authenticateAgent accepts AGENT_TOKEN env var (or JWTs with role 'agent').

If you want, I can also:
- Add a GET /agents/commands endpoint that agents can poll to fetch pending commands and mark them delivered.
- Provide a systemd unit and installer script for the agent scanner.
