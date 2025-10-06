# ApagaNet Backend (MVP v0.1)

API en Node/Express para manejar usuarios, dispositivos y horarios.
Endpoints: `/ping`, `/auth/login`, `/devices`, `/schedules`, `/diag`

## Iniciar local
```bash
npm install
cp .env.example .env
npm run dev
```

## Deploy en Render (Node runtime, no Docker)
- Build Command: `npm install`
- Start Command: `node server.js`
- Env Vars:
  - `APP_NAME=ApagaNet`
  - `APP_ENV=prod`
  - `PORT=10000` (Render usa su propio puerto pero dejamos default)
  - `JWT_SECRET=apaganet-secret-dev`
