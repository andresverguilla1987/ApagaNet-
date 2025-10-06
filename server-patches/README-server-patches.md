# Server patches — cola de acciones para agente

## Migración SQL (nuevas tablas)
Ver `migrations/003_agents_and_actions.sql`

## Endpoints mínimos (añadir a tu server)
```js
// Registro del hogar / agente (opcional)
app.post("/agents/register", requireAuth, async (req,res)=>{ /* asigna homeId al user, crea token */ });

// Cola: el agente pide próximas acciones
app.get("/agents/next-actions", async (req,res)=>{ /* auth por Bearer apiToken; devuelve acciones pendientes */ });

// Reporte: el agente informa resultado
app.post("/agents/report", async (req,res)=>{ /* marca acción como done/failed */ });
```

## Cómo funciona
- Tu **scheduler** decide quién va bloqueado y encola acciones (`block`/`unblock`) por `device_id`.
- El **agente** pregunta cada 30s por `homeId` y ejecuta con OpenWrt/UniFi.
- Reporta el resultado y la cola pasa a la siguiente.
