# ApagaNet Backend (Render Ready v0.1.1)

Estructura en la RAÍZ (no subcarpeta). Lista para Render (runtime Node, sin Docker).

## Endpoints
- GET /ping
- GET /diag
- POST /auth/login { email, name? }
- GET/POST/PATCH/DELETE /devices
- GET/POST/PATCH/DELETE /schedules

## Local
npm install
cp .env.example .env
npm run dev

## Render (Node runtime)
- Build Command: npm install
- Start Command: node server.js
- Env Vars:
    APP_NAME=ApagaNet
    APP_ENV=prod
    PORT=10000
    JWT_SECRET=apaganet-secret-dev

Si Render te muestra 502, verifica que el repo tenga `server.js` y `package.json` en la raíz,
y que las rutas existan en `src/routes/*.js`.
