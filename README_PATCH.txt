Auto-patch ZIP for ApagaNet
===========================

What this package does:
- Inserts two GET routes into your server.js to serve the latest reports:
  - GET /agents/modem-compat/latest?agent_id=...
  - GET /agents/devices/latest?agent_id=...
- Adds a robust frontend widget file (compat_widget.js) to public/ that will work with the injected routes.
- Includes a migration SQL to create the minimal report tables if they don't exist.
- Provides apply_patch.sh which, when run from your repo root, will:
    * backup server.js
    * insert the routes block before the '404 & errores' section
    * copy compat_widget.js to public/
    * copy migration SQL to migrations/

Usage (on your machine / server):
1. Download/unzip this package into your repo root.
2. From repo root run:
   chmod +x apply_patch.sh
   ./apply_patch.sh
3. Run the migration SQL against your Postgres DB:
   psql "host=$PGHOST user=$PGUSER dbname=$PGDATABASE password=$PGPASSWORD" -f migrations/migration_add_agent_reports.sql
4. Restart your backend (or push to Render/GitHub so your host redeploys).
5. Ensure APAGANET_BASE_URL is set in your frontend environment and that an admin JWT is in localStorage for testing.

Notes:
- The script edits server.js by inserting a block before the comment line '// ---------- 404 & errores ----------' which exists in your original file; if your file differs significantly, inspect server.js.new in the backup folder.
- Always backup before running in production.
