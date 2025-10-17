# Alerts package (ApagaNet)

Archivos listos para agregar **alertas** al backend:

- `src/routes/alerts.js` — Router Express con:
  - `GET  /v1/parents/device/:deviceId/alerts`
  - `POST /v1/parents/device/:deviceId/alerts` (reemplaza reglas del device)
  - `POST /v1/parents/device/:deviceId/alerts/test-dispatch` (prueba email/webhook)
- `scripts/migrations/011_alert_rules.sql` — tabla `alert_rules`

## Pasos

1. Copia **src/routes/alerts.js** a tu repo en `src/routes/alerts.js` (o `Fuente/Rutas/alerts.js` si usas la convención en español y ajusta el import).
2. En `server.js` importa y monta el router:

   ```js
   import alerts from "./src/routes/alerts.js";
   app.use("/", alerts);
   app.use("/api", alerts); // opcional alias
   ```

   > Si tu carpeta de rutas es `Fuente/Rutas/`, usa: `import alerts from "./Fuente/Rutas/alerts.js"`

3. Ejecuta la migración `scripts/migrations/011_alert_rules.sql` en tu Postgres (Render).
4. Asegúrate de tener variables de entorno SMTP si vas a probar emails:

   ```env
   SMTP_HOST=...
   SMTP_PORT=587
   SMTP_USER=...
   SMTP_PASS=...
   SMTP_SECURE=false
   MAIL_FROM="ApagaNet <no-reply@apaganet>"
   ```

5. `npm i nodemailer node-fetch` (si tu runtime ya trae `fetch`, puedes quitar `node-fetch` del archivo).

6. Deploy en Render.
