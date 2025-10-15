# ApagaNet — Drop-in v1 (tracking + trips + tamper + app rules)

Este ZIP está pensado para **reemplazar tu `server.js` actual** y añadir endpoints `/v1/*` SIN romper lo que ya tienes.
Incluye además una migración SQL y una colección Postman.

## Contenido
- `server.js` — tu servidor con los endpoints /v1 ya integrados.
- `sql/feature_tracking_001.sql` — tablas nuevas (idempotente).
- `postman/ApagaNet_v1_tracking.postman_collection.json` — pruebas.

## Pasos (Render, sobre el MISMO servicio)
1) **Backup** de DB recomendado (opcional).
2) Ejecuta la migración en tu Postgres:
   - Abre tu consola con `psql` apuntando a `DATABASE_URL` y corre:
   ```
   \i sql/feature_tracking_001.sql
   ```
   (o pega su contenido en tu herramienta SQL).
3) Reemplaza tu archivo `server.js` por el de este ZIP.
4) Deploy en Render. Comprueba:
   - `GET /api/health` responde ok.
5) Prueba con Postman:
   - Importa `postman/ApagaNet_v1_tracking.postman_collection.json`
   - Setea `BASE_URL` = URL de tu backend
   - Setea `JWT` con un token válido de tu login

## Notas
- Los nuevos endpoints usan prefijo `/v1/...` para no chocar con tus rutas.
- Si tu `devices.id` no es texto, ajusta el tipo de `device_id` en la SQL.
- No agregué Socket.IO para evitar refactor de `app.listen`. Si luego quieres live por websockets, lo añadimos sin romper rutas.

Fecha: 2025-10-15
