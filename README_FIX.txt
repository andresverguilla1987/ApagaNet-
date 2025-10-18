# ApagaNet – Fix email router (zip)

Este paquete agrega el **router que falta** en `src/routes/email.js` y una utilidad simple de SMTP en `src/lib/emailSvc.js`.

## Qué corrige
Render fallaba con:

`ERR_MODULE_NOT_FOUND: ... '/src/src/routes/email.js'`

Tu `server.js` ya importaba `./src/routes/email.js` pero ese archivo no existía. Este zip lo añade.

## Cómo aplicar
1. Descomprime el zip en la **raíz del proyecto**. Debes terminar con:
   - `src/routes/email.js`
   - `src/lib/emailSvc.js`
2. Asegúrate que en `server.js` tengas el import así (si `server.js` está en la raíz):

```js
import emailRouter from "./src/routes/email.js";
app.use("/api/email", emailRouter);
app.use("/email", emailRouter);
```

> Si tu `server.js` está dentro de `src/`, la ruta sería `../routes/email.js`.

3. Define variables SMTP en Render:
   - `SMTP_HOST`
   - `SMTP_PORT` (465 ó 587)
   - `SMTP_USER`
   - `SMTP_PASS`
   - (opcional) `MAIL_FROM`
   - `TASK_SECRET` (el mismo que usas para admin)

4. **Redeploy** (si puedes, "Clear build cache & deploy").

## Endpoints añadidos
- `GET  /api/email/verify`           (header: `x-admin-secret: <TASK_SECRET>`)
- `POST /api/email/test`             body: `{ "to": "correo@dominio.com" }`
- `POST /api/email/alert-demo`       body: `{ "to", "title", "level", "deviceName", "timeISO", "detailsUrl" }`

Todos requieren `x-admin-secret` con tu `TASK_SECRET` (compat con tu middleware que mapea Authorization/x-task-secret → x-admin-secret).
