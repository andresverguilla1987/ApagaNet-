# ApagaNet Phase 3 Bundle

Este ZIP contiene `server.js` (ESM) ya integrado con rutas `/api/email` y `/email`,
y el paquete SMTP (`email/`, `routes/email.js`, plantillas y README_SMTP_PHASE3.md).

Pasos:
1) `npm i nodemailer`
2) Copia todo a tu backend (reemplaza `server.js` si corresponde).
3) Configura env en Render (SMTP_*, TASK_SECRET, etc.).
4) Re-deploy y prueba los endpoints:
   - GET  /api/email/verify
   - POST /api/email/test
   - POST /api/email/alert-demo
