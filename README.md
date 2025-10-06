# ApagaNet Backend — JWT Ready (v0.2.2)

Este paquete reemplaza tu backend con **PostgreSQL + JWT** listo:
- `server.js` con CORS fino, helmet, rate-limit, compression, rutas protegidas.
- `src/lib/authz.js` (middleware JWT)
- `src/routes/auth.js` (devuelve token)
- `src/routes/devices.js` y `schedules.js` usan `req.userId` (no x-user-id)
- `package.json` trae `jsonwebtoken`

## Variables necesarias (Render → Environment)
- `DATABASE_URL=postgres://...`
- `JWT_SECRET=<tu secreto largo>`
- `CORS_ORIGINS=https://tu-frontend.netlify.app,https://harmonious-dragon-71a2fa.netlify.app,http://localhost:5173`
- `APP_NAME=ApagaNet`
- `APP_ENV=prod`
- `PORT=10000`
- (opcional) `TASK_SECRET=...` para el cron

## Deploy
1) Sube estos archivos a la **raíz** del repo (reemplazando los existentes).
2) `git add . && git commit -m "jwt ready v0.2.2" && git push`
3) En Render: **Manual Deploy → Clear build cache & deploy**
4) Prueba `/ping` y luego el flujo:
   - `POST /auth/login` → recibe `token`
   - Usar `Authorization: Bearer <token>` en `/devices` y `/schedules`
