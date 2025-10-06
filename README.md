# ApagaNet Backend — PostgreSQL (v0.2.0)

Backend listo para Render + Postgres.

## Variables de entorno
- `DATABASE_URL` → la URL de tu base de datos PostgreSQL en Render
- `PORT` → 10000 (Render asigna una, pero dejamos default)
- `APP_NAME`, `APP_ENV`
- `TASK_SECRET` → para el endpoint de cron `/tasks/run-scheduler`
- `CORS_ORIGINS` → dominios permitidos (coma separada)

## Migración
```bash
npm install
npm run migrate
npm run dev
```

En Render:
- Add → PostgreSQL (Free)
- Copia la `External Database URL` en `DATABASE_URL`
- Deploy → (opcional) ejecuta `npm run migrate` local o temporalmente con un Shell

## Endpoints
- GET `/ping`  → prueba de vida + DB
- GET `/diag`  → diagnóstico
- POST `/auth/login` { email, name? } → upsert usuario
- GET/POST/PATCH/DELETE `/devices`
- GET/POST/PATCH/DELETE `/schedules`
- POST `/tasks/run-scheduler` (requiere `Authorization: Bearer TASK_SECRET`)
