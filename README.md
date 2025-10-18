ApagaNet - Fase 1

Contenido:
 - scripts/migrate_phase1.sql
 - src/lib/db.js

Uso:
 - Subir a tu repo o descargar el zip y descomprimir.
 - Ejecutar la migración:
   - En Render Web Shell: psql "$DATABASE_URL" -f scripts/migrate_phase1.sql
   - O agregar script en package.json: "migrate:phase1": "psql \"$DATABASE_URL\" -f scripts/migrate_phase1.sql"

Asegúrate de tener la variable DATABASE_URL configurada en tu entorno de Render.
