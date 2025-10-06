# ApagaNet Backend — Ready Pack

## 1) Variables de entorno
- `DATABASE_URL` (PostgreSQL de Render)
- `JWT_SECRET` (cadena larga)
- `TASK_SECRET` (para /tasks/run-scheduler)
- `CORS_ORIGINS` (coma sin espacios) — opcional
- `PORT=10000`

## 2) Migraciones
- Render → Web Service → Shell (ubicación /opt/render/project/src)
```bash
npm run migrate
```

## 3) Arranque
Render usará `npm start` automáticamente. Local:
```bash
cp .env.example .env
npm install
npm run migrate
npm start
```

## 4) Probar
- Login:
```bash
curl -s -X POST http://localhost:10000/auth/login     -H 'Content-Type: application/json'     -d '{"email":"demo@apaganet.app","name":"Demo"}'
```
- Con el token, listar/crear devices:
```bash
TOKEN=...
curl -s http://localhost:10000/devices -H "Authorization: Bearer $TOKEN"
```
- Scheduler (POST + TASK_SECRET):
```bash
curl -s -X POST http://localhost:10000/tasks/run-scheduler     -H "Authorization: Bearer TU_TASK_SECRET"
```
