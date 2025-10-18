# ApagaNet — Fase 3: SMTP real con Nodemailer (drop‑in)

Este paquete añade **correo transaccional** (verificación y alertas) usando SMTP con Nodemailer.

## Archivos

- `email/config.js` — crea el transporter (pool, DKIM opcional).
- `email/mailer.js` — `sendAlertEmail`, `sendTest`, `verify` con reintentos.
- `email/templates/alert.html` y `alert.txt` — plantilla de alerta.
- `routes/email.js` — rutas `/email/verify`, `/email/test`, `/email/alert-demo` protegidas con `x-admin-secret`.

## Instalación

1) Instala dependencias en tu backend:
```bash
npm i nodemailer
```

2) Copia la carpeta `email/` y `routes/email.js` a tu repo del backend y añade la ruta al servidor Express:
```js
// server.js (o app.js)
app.use('/email', require('./routes/email'));
```

3) Variables de entorno (Render → Environment):
- `SMTP_HOST`
- `SMTP_PORT` (465 para TLS implicito, 587 para STARTTLS)
- `SMTP_SECURE` (`true` con 465, `false` con 587)
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM` (ej. "ApagaNet <no-reply@tudominio.com>")
- `SMTP_REPLY_TO` (opcional)
- `SMTP_POOL` (true/false)
- `SMTP_POOL_MAX_CONNECTIONS` (ej. 3)
- `SMTP_POOL_MAX_MESSAGES` (ej. 100)
- `DKIM_DOMAIN`, `DKIM_SELECTOR`, `DKIM_PRIVATE_KEY_BASE64` (opcional)
- `TASK_SECRET` (se usa en el header `x-admin-secret` para probar endpoints)

> Para DKIM: pega la **llave privada** en base64 en `DKIM_PRIVATE_KEY_BASE64`. El TXT DNS con el selector debe existir.

## Endpoints de prueba (admin)

- `GET /email/verify` — verifica conexión SMTP.
- `POST /email/test` — envía un correo simple. Body JSON: `{ "to": "tucorreo@..." }`
- `POST /email/alert-demo` — envía correo usando la plantilla. Body JSON: 
```json
{
  "to": "tucorreo@...",
  "title": "Actividad inusual detectada",
  "level": "warning",
  "deviceName": "Tablet de Juan",
  "timeISO": "2025-10-17T01:23:45Z",
  "detailsUrl": "https://tu-frontend.netlify.app/alerts/123"
}
```

Todos requieren header: `x-admin-secret: <TASK_SECRET>`

## PowerShell (Render / local)

```powershell
$BASE = "https://apaganet-zmsa.onrender.com"
$HEAD = @{ "x-admin-secret" = "$env:TASK_SECRET"; "Content-Type" = "application/json" }

# 1) Verificar transporter
Invoke-RestMethod -Method Get -Uri "$BASE/email/verify" -Headers $HEAD

# 2) Test simple
$body = @{ to = "tu@correo.com" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$BASE/email/test" -Headers $HEAD -Body $body

# 3) Alerta demo (plantilla)
$alert = @{
  to="tu@correo.com"
  title="Actividad inusual detectada"
  level="critical"
  deviceName="Laptop de Ana"
  timeISO=(Get-Date).ToUniversalTime().ToString("o")
  detailsUrl="https://tu-frontend.netlify.app/alerts/123"
} | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$BASE/email/alert-demo" -Headers $HEAD -Body $alert
```

## Integración con `/alerts` real

Cuando crees una alerta en tu endpoint real (`POST /alerts`), después de persistir en Postgres, llama a:
```js
const { sendAlertEmail } = require('./email/mailer');
await sendAlertEmail(user.email, {
  title: 'Nueva alerta',
  level: alert.level, // info|warning|critical
  deviceName: device.name,
  timeISO: new Date(alert.created_at).toISOString(),
  detailsUrl: `${PUBLIC_APP_URL}/alerts/${alert.id}`
});
```

## Seguridad y entregabilidad

- Usa un dominio propio (`no-reply@tudominio.com`) y configura **SPF** y **DKIM**.
- Para STARTTLS (587), pon `SMTP_SECURE=false` y asegúrate de que el proveedor soporte TLS.
- Mantén `TASK_SECRET` en Render y **no** lo publiques.
- El pool ayuda a throughput; ajusta `SMTP_POOL_MAX_*` según tu volumen.
- Si recibes `ECONNECTION`, `ETIMEDOUT` o `EAUTH`, revisa host/puerto/credenciales y permisos del proveedor.

---

Hecho con ❤️ para ApagaNet.
