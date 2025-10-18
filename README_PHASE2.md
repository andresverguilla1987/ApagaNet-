# ApagaNet — Fase 2 (Endpoints básicos)

Este paquete añade:
- `POST /notifications/subscriptions` — crear suscripciones `email` o `webhook`
- `POST /alerts` — registrar alertas (protegido con TASK_SECRET)
- `POST /admin/notifications/dispatch` — despachar alertas recientes a subs (webhook: real, email: placeholder)

## Archivos
- `src/routes/notifications.js`
- `src/routes/alerts-system.js`

## Integración en `server.js`
Asegúrate de montar así (ejemplo):
```js
import notifications from "./src/routes/notifications.js";
import alertsSystem from "./src/routes/alerts-system.js";

function requireTaskSecret(req, res, next) {
  const expected = (process.env.TASK_SECRET || "").trim();
  const h = (req.headers["x-task-secret"] || "").toString().trim();
  const bearer = (req.headers.authorization || "").startsWith("Bearer ")
    ? req.headers.authorization.slice(7).trim()
    : "";
  const provided = h || bearer;
  if (!expected) return res.status(500).json({ ok:false, error:"TASK_SECRET no configurado" });
  if (!provided) return res.status(401).json({ ok:false, error:"Falta credencial admin" });
  if (provided !== expected) return res.status(401).json({ ok:false, error:"TASK_SECRET inválido" });
  next();
}

app.use("/", notifications);
app.use("/", requireTaskSecret, alertsSystem);
```

## Test rápido (PowerShell)
```powershell
$API         = "https://tu-app.onrender.com"
$TASK_SECRET = "<el_de_Render>"
$HEAD        = @{ "X-Task-Secret" = $TASK_SECRET }
$HOMEID      = "HOME_TEST"
$WEBHOOK     = "https://webhook.site/<tu-id>"

# Crear subs webhook
Invoke-RestMethod -Method Post -Uri "$API/notifications/subscriptions" -ContentType 'application/json' -Body (@{
  type="webhook"; endpoint_url=$WEBHOOK; home_id=$HOMEID
} | ConvertTo-Json -Compress)

# Crear alerta
Invoke-RestMethod -Method Post -Uri "$API/alerts" -Headers $HEAD -ContentType 'application/json' -Body (@{
  level="warn"; title="Fase2 OK"; message="Hola"; home_id=$HOMEID
} | ConvertTo-Json -Compress)

# Dispatch
Invoke-RestMethod -Method Post -Uri "$API/admin/notifications/dispatch" -Headers $HEAD
```
