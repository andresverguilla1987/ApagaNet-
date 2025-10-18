# ApagaNet — Email Outbox + Dedupe + Worker (ESM)

Este bundle agrega una cola de correos transaccionales con:
- **Dedupe** por `dedupe_key` (evita duplicados sin borrar nada).
- **Outbox** en Postgres con estados (`pending → sending → sent|failed`).
- **Reintentos** con backoff y `retry_at`.
- **Worker** seguro con `FOR UPDATE SKIP LOCKED` (eficiente y sin doble envío).
- Idempotencia lista si usas header `Idempotency-Key` (ver comentarios en código).

## Archivos
- `db/migrations/20251018_email_outbox.sql` — crea la tabla `email_outbox` e índices.
- `src/lib/emailQueue.js` — utilidades de encolado y procesamiento (ESM).
- `server-integration-snippet.txt` — snippet para `server.js` y ejemplo de uso en `/alerts`.

## Pasos
1. Ejecuta la migración SQL en tu Postgres (Render → psql o desde tu sistema de migraciones).
2. Copia `src/lib/emailQueue.js` a tu proyecto (respeta la ruta).
3. En `server.js`, importa y agrega el `setInterval(...)` del snippet.
4. En tu handler real de `/alerts`, usa `enqueueEmail(...)` (ejemplo en el snippet).
5. Verifica en logs: `[email-worker] processed N` cuando existan pendientes.

## Notas
- Requiere `gen_random_uuid()` (extensión `pgcrypto`). Si tu Postgres no la tiene, cambia el `DEFAULT` de `id` por `uuid_generate_v4()` y activa la extensión `uuid-ossp`, o genera UUID desde Node.
- Ajusta el `limit` y la frecuencia del worker según tu volumen.
- El envío real lo hace `email/mailer.js` que ya integraste en Fase 3.

Hecho para que no vuelva a tronar por duplicados 😉
