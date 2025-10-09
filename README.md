# ApagaNet - Quick fix package (Render / GitHub / Netlify tester)

## What is inside
- `server.js` - backend entry (Express) — based on your provided file.
- `package.json` - basic scripts (start, migrate).
- `migration.sql` - DB migration for agent reports.
- `src/routes/agents.js` - DB-backed agents endpoints with fallback memory.
- `agent/apaganet_agent.sh` - simple LAN scanner & reporter (install on LAN device).
- `netlify/index.html` - minimal Netlify tester UI (drop into Netlify site or `public/`).
- `netlify/compat_widget.js` - front-end widget script used by index.html.
- `install.sh` - helper script with recommended commands (inspect before running).
- `.gitignore`

## Quick usage notes

### Backend (Render / GitHub)
1. Push repo to GitHub (root of repo).
2. On Render: Create a **Web Service**. Set `Start Command` to:
   ```
   npm start
   ```
3. **Important environment variables**:
   - `DATABASE_URL` - Postgres connection.
   - `AGENT_TOKEN` - secret shared with agents.
   - `JWT_SECRET` - for admin auth (if used).
   - `TASK_SECRET` - for scheduled tasks.
   - `CORS_ORIGINS` - comma separated allowed origins (include your Netlify site).
4. After deploy, run migrations:
   ```
   npm run migrate
   ```
   or run the SQL in `migration.sql` against your DB.

### Frontend (Netlify)
- Deploy the `netlify/` folder as your Netlify site (either upload its contents or set build to copy).
- Ensure Netlify proxy rewrites `/api/*` to your Render backend (Netlify _redirects_ or proxy).
- Add your Netlify URL to `CORS_ORIGINS` on the backend, redeploy backend.

### Agent (LAN)
- Copy `agent/apaganet_agent.sh` to a LAN machine (`~/bin` or `/usr/local/bin`), `chmod +x`.
- Export `APAGANET_URL`, `AGENT_TOKEN`, `AGENT_ID` then run once to post reports.

## Deliverable
This ZIP is a convenience bundle. Inspect every file before deploying. Replace tokens and URLs as needed.
