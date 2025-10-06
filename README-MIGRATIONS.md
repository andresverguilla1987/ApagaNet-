# ApagaNet — Migraciones (PostgreSQL)

Este paquete agrega migraciones SQL y un script para aplicarlas desde tu servicio en Render o local.

## Contenido
- `src/migrations/001_base.sql` → extensiones, `users`, `devices`, `schedules`, `schedule_runs` e índices.
- `src/migrations/003_agents_and_actions.sql` → (opcional) cola y autenticación de agentes (`homes`, `agents`, `actions`).
- `scripts/migrate.js` → ejecuta todos los `.sql` en `src/migrations` (ordenados alfabéticamente).

## Cómo usar en tu repo (GitHub)
1. Copia estas carpetas/archivos en tu repo:
   - `src/migrations/*.sql`
   - `scripts/migrate.js`
2. En tu `package.json` agrega el script:
   ```json
   {
     "scripts": {
       "migrate": "node scripts/migrate.js"
     }
   }
   ```
3. En Render → **Environment**, asegúrate de tener `DATABASE_URL` (ya la tienes).
4. Ejecuta la migración:
   - Render → tu servicio → **Shell** → `npm run migrate`
   - ó local: con `.env` que contenga `DATABASE_URL=...` → `npm run migrate`

## Notas
- El script activa SSL automáticamente para conexiones de Render (`rejectUnauthorized:false`).
- Puedes agregar nuevas migraciones como `004_loquesea.sql` y volver a ejecutar.
