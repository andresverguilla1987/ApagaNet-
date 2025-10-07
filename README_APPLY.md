# ApagaNet backend patch (agents)

Archivos listos para:
- Reemplazar tu `server.js` con soporte de `/agents`
- Añadir ruta `src/routes/agents.js`
- Crear SQL `src/sql/004_agents_min.sql` (homes, agents, agent_reports)
- Script `scripts/migrate-agents.js` para aplicar la migración

## Pasos
1. **Back up** tu `server.js` actual.
2. Copia estos archivos a tu repo en las mismas rutas.
3. En `package.json` agrega el script:
   ```json
   { "scripts": { "migrate:agents": "node scripts/migrate-agents.js" } }
   ```
4. Ejecuta la migración (Render Shell o local):
   ```bash
   DATABASE_URL="postgresql://..." npm run migrate:agents
   ```
5. Redeploy.

## Probar
- `GET /agents/next-actions?homeId=<HOME_ID>` con Header `Authorization: Bearer <AGENT_TOKEN>`
- `POST /agents/report` body `{ "homeId":"<HOME_ID>", "results":[{"action":"block","ok":true}] }`

> Nota: la lógica de `next-actions` es demo (UTC HH:MM); ajusta a tu timezone/regla real.
