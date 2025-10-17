# ApagaNet — Alerts API Add‑on (drop‑in)
Fecha: 2025-10-17

Este paquete agrega **CRUD de alerts** con `mark as read`, filtros y autenticación mixta **JWT** (usuarios) y **TASK_SECRET** (agentes/cron). Está diseñado para integrarse a tu backend Express actual en Render.

## Contenido
- `routes/alerts.js` — Router Express con endpoints:
  - `POST /alerts` — crear alerta
  - `GET /alerts` — listar con filtros (`home_id`, `device_id`, `since`, `unread`, `limit`)
  - `GET /alerts/:id` — obtener una alerta
  - `PATCH /alerts/:id/read` — marcar/ desmarcar como leída
  - `PUT /alerts/:id` — actualizar campos (título, mensaje, metadata, nivel)
  - `DELETE /alerts/:id` — eliminar
- `middleware/auth.js` — Soporta **Authorization: Bearer <JWT>** *o* encabezado **X-Task-Secret: <clave>**.
- `db/index.js` — Conexión `pg` usando `DATABASE_URL` (Render).
- `db/migrations/2025-10-16_add_alerts.sql` — Crea tabla `alerts` + índices + extensiones seguras.
- `postman/ApagaNet Alerts.postman_collection.json` — Colección lista para pruebas Smoke.
- `server.example.js` — Ejemplo mínimo para correr solo este router.
- `.env.example` — Variables requeridas.

## Instalación rápida
1) Copia `/routes/alerts.js`, `/middleware/auth.js` y `/db/*` a tu repo backend.
2) Ejecuta la migración en Render PostgreSQL (Query):  
```sql
\i db/migrations/2025-10-16_add_alerts.sql
```
3) Monta el router en tu `server.js` actual:
```js
const alertsRouter = require('./routes/alerts');
app.use('/alerts', alertsRouter);
```
4) Define variables en Render:
```
DATABASE_URL=postgres://...
JWT_PUBLIC_KEY_PEM="-----BEGIN PUBLIC KEY-----..."
TASK_SECRET=coloca_una_clave_larga
```
> Usa `JWT_PUBLIC_KEY_PEM` si firmas tokens con RS256; si usas HS256, pon `JWT_SECRET` y deja vacío `JWT_PUBLIC_KEY_PEM`.

5) Deploy y prueba con la colección Postman incluida.

## Endpoints (resumen)
- **POST /alerts**
  - Body: `level` (info|warn|critical), `title` (req), `message?`, `home_id?`, `device_id?`, `metadata?` (obj)
  - Auth: JWT *o* X-Task-Secret
- **GET /alerts**
  - Query: `home_id?`, `device_id?`, `since?` (ISO), `unread?=1`, `limit?` (1..200)
  - Auth: JWT *o* X-Task-Secret
- **PATCH /alerts/:id/read**
  - Body: `{ "read": true|false }`
  - Auth: JWT *o* X-Task-Secret

### Reglas de autorización
- Con **JWT**: `user_id` se toma de `payload.sub` o `payload.user_id`. Las consultas listan **sólo** alerts del usuario (`user_id`) o de sus `home_id` (si coinciden con el token cuando uses esa relación).
- Con **TASK_SECRET**: se permiten operaciones siempre que especifiques `home_id` o `device_id` (pensado para agentes/cron).

## SQL principal
Consulta `db/migrations/2025-10-16_add_alerts.sql` para detalles (UUID, índices y GIN en metadata).

## cURL Smoke
```bash
# Crear (agente)
curl -X POST "$API_URL/alerts" -H "X-Task-Secret: $TASK_SECRET" -H "Content-Type: application/json" -d '{"level":"warn","title":"Uso alto de datos","message":"El dispositivo excedió 2GB","home_id":"HOME123","device_id":"AA:BB:CC","metadata":{"gb":2.4}}'

# Listar no leídas (JWT)
curl -H "Authorization: Bearer $JWT" "$API_URL/alerts?unread=1&limit=20"

# Marcar como leída
curl -X PATCH "$API_URL/alerts/ALERT_UUID/read" -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" -d '{"read":true}'
```

---

**Nota**: Este add‑on no altera tablas existentes. Si ya tienes usuarios/hogares, conecta `home_id` y `user_id` según tu modelo.
