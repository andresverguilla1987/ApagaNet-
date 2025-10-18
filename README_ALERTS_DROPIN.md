# Alerts + Email Outbox (Drop-in)

Este router `alerts.enqueued.js` reemplaza (o complementa) tu router de alerts con envío de correo **idempotente** vía outbox.

## Uso

1. Asegúrate de haber instalado el bundle de **Email Outbox** (`src/lib/emailQueue.js` y migración SQL).
2. Copia este archivo a `src/routes/alerts.enqueued.js`.
3. En `server.js`, monta **en lugar** de tu router de alerts actual (o en paralelo):
   ```js
   import alertsEnqueued from "./src/routes/alerts.enqueued.js";
   app.use("/v1", requireJWT, alertsEnqueued);
   app.use("/api/v1", requireJWT, alertsEnqueued);
   ```
4. Endpoints:
   - `GET    /v1/alerts` — lista últimas 200 alertas.
   - `POST   /v1/alerts` — crea alerta y **encola** correo (no duplica).
   - `PATCH  /v1/alerts/:id/read` — marca como leída.

## Notas
- Asume tabla `alerts` con columnas (`id`, `user_id`, `device_id`, `level`, `title`, `created_at`, `read_at`). Ajusta queries si tu esquema es distinto.
- Toma `user.id` y `user.email` desde el JWT (`requireJWT` ya lo mete en `req.user`).
- Construye el `dedupeKey` con `to + template + alert.id` ⇒ si el endpoint se llama dos veces, **solo se envía una vez**.
- `PUBLIC_APP_URL` se usa para el link del detalle si no mandas `details_url` en el body.
