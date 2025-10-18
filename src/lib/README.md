
# ApagaNet — Smoke & SMTP Tools (PowerShell)

Este paquete contiene 2 scripts de verificación rápida para tu API en Render.

## Requisitos
- Windows PowerShell 5+ o PowerShell 7+
- Tu `TASK_SECRET` real de Render
- Una cuenta SMTP ya configurada en el backend (variables de entorno)

## 1) Smoke completo (JWT + Alert + Email)
Script: `apaganet-smoke.ps1`  
Valida:
- `/admin/jwt` (mint JWT usando `TASK_SECRET`)
- `/api/email/verify`
- `/api/email/test` (correo simple)
- `/api/v1/alerts` (alerta protegida con JWT, manda email de plantilla)

### Uso
```powershell
# Parámetros mínimos
.\apaganet-smoke.ps1 -Base "https://apaganet-zmsa.onrender.com" -TaskSecret "TU_TASK_SECRET" -To "tucorreo@dominio.com"

# Opcionales
.\apaganet-smoke.ps1 `
  -Base "https://apaganet-zmsa.onrender.com" `
  -TaskSecret "TU_TASK_SECRET" `
  -To "tucorreo@dominio.com" `
  -UserId "u1" -UserEmail "demo@apaganet.test"
```

Salida esperada: todos los pasos con ✅ y respuestas `{ ok: true }`.

## 2) Nota administrativa (dispatch por nivel/ canal)
Script: `apaganet-admin-dispatch.ps1`  
Usa `/admin/notifications/dispatch` con tu `TASK_SECRET` para disparar una notificación por canal/ nivel.

### Uso
```powershell
.\apaganet-admin-dispatch.ps1 -Base "https://apaganet-zmsa.onrender.com" -TaskSecret "TU_TASK_SECRET" -To "tucorreo@dominio.com"
```

## Tips
- Si `/api/email/test` falla, revisa variables SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`.
- Para `/api/v1/alerts` necesitas el JWT que emite `/admin/jwt` (por eso el script lo genera primero).
- Si usas firewall/ red corporativa, permite salidas SMTP (TLS) hacia tu proveedor.
