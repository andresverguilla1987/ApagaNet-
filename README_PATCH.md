# Patch: /agents endpoints

Este paquete agrega:
- `src/routes/agents.js` → rutas:
  - `GET /agents/next-actions?homeId=...`
  - `POST /agents/report`
- `src/sql/004_agents_min.sql` → crea tablas mínimas (idempotente)
  - `homes`, `agents`, `agent_reports`
- `scripts/migrate-agents.js` → aplica la SQL

## Cómo aplicar a tu backend existente

1) Copia los archivos a las rutas indicadas dentro de tu repo del backend.
   - Si tu estructura difiere, ajusta los `import` y paths.

2) Agrega el script a `package.json`:
```json
{
  "scripts": {
    "migrate:agents": "node scripts/migrate-agents.js"
  }
}
```

3) Ejecuta la migración (local o en Render Shell):
```bash
DATABASE_URL="postgresql://..." npm run migrate:agents
```

4) Monta la ruta en tu `server.js` (o equivalente):
```js
import agents from "./src/routes/agents.js";
app.use("/agents", agents);
```

5) Deploy.

## Notas
- `GET /agents/next-actions` calcula acciones simples con base en `schedules` activos
  y el estado `devices.blocked`. Si el dispositivo no está bloqueado durante la ventana,
  devuelve una acción `block`. (Usa `UTC` para la comparación HH:MM en la demo).
- `POST /agents/report` guarda los resultados en `agent_reports.payload` (JSONB).
- Extiende `executeAction()` en tu agente para integrar con tu router real.
