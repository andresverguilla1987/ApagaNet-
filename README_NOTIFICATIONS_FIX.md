# ApagaNet — Notifications Fix Pack
Incluye:
- db/migrations/20251018_notifications.sql
- src/routes/notifications.pro.js
- scripts/seed_notifications.sql

1) Monta en server.js:
import notificationsPro from "./src/routes/notifications.pro.js";
app.use("/", notificationsPro);

2) Migración:
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c 'CREATE EXTENSION IF NOT EXISTS pgcrypto;'
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/20251018_notifications.sql

(Seed opcional)
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/seed_notifications.sql
