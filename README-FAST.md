# ApagaNet FixPack v1

**What is this?**
A clean pack with:
- SQL migrations (base + agent queue).
- A Node migrate script.
- Server snippet for /agents and /debug endpoints.

## Files
- scripts/migrate.js
- src/migrations/001_base.sql
- src/migrations/003_agents_and_actions.sql
- server-snippets/patch-endpoints.js
- README-FAST.md (this file)

## How to apply (GitHub repo)
1) Unzip into your repo root (you should see /scripts and /src/migrations).
2) Edit package.json and add:
   {
     "scripts": { "migrate": "node scripts/migrate.js" }
   }
3) Commit & push.

## Run migrations on Render
Open your Web Service → Shell (working dir must be /opt/render/project/src):
  npm run migrate

DATABASE_URL must be present in your service environment (Render → Environment).
If you prefer raw psql:
  psql "$DATABASE_URL" -f src/migrations/001_base.sql
  psql "$DATABASE_URL" -f src/migrations/003_agents_and_actions.sql

## Add endpoints
Open server.js and paste the content of:
  server-snippets/patch-endpoints.js
right after you define `pool` and `app` (and after express.json()).

## Quick test
  curl -s -X POST https://YOUR-APP.onrender.com/auth/login       -H 'Content-Type: application/json'       -d '{"email":"demo@apaganet.app","name":"Demo"}'

  # Use token:
  curl -s https://YOUR-APP.onrender.com/devices -H "Authorization: Bearer TOKEN"

  # Scheduler (remember: POST + TASK_SECRET)
  curl -s -X POST https://YOUR-APP.onrender.com/tasks/run-scheduler       -H "Authorization: Bearer YOUR_TASK_SECRET"
