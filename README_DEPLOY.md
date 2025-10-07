# ApagaNet backend final (patch)

Contenido:
- `server.js` (monta /agents, /admin y sirve /admin/ui)
- `src/routes/admin.js` (crear homes/agents, protegido por TASK_SECRET)
- `src/admin-ui/index.html` (panel admin estático)
- `src/sql/001_base.sql` (users, devices, schedules, schedule_runs)
- `src/sql/004_agents_min.sql` (homes, agents, actions)
- `scripts/migrate.js` (runner de migraciones)

## Cómo integrar
1. Copia estos archivos a tu repo (respetando rutas).
2. Asegúrate de tener `src/lib/db.js` y los routers existentes (`auth.js`, `devices.js`, `schedules.js`, `agents.js`).
3. En Render, variables:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `TASK_SECRET`
   - `CORS_ORIGINS` (opcional)
4. Migraciones:
   ```bash
   npm i pg
   DATABASE_URL="postgresql://user:pass@host/db" node scripts/migrate.js
   ```
5. Deploy. Abre:
   - Panel: `/admin/ui`
   - Admin API: `/admin/*` (Bearer TASK_SECRET)
   - Agente: `/agents/*` (Bearer AGENT_TOKEN)
