# Scheduler Patch — ApagaNet (PostgreSQL)

Agrega lógica de scheduler:
- Evalúa `schedules` activos por día/hora.
- Marca `devices.blocked` true/false.
- Audita en `schedule_runs`.

## Pasos
1) Copia `src/lib/scheduler.js` y `src/migrations/002_device_block_state.sql` a tu repo.
2) En `server.js` aplica el snippet de `server.js.scheduler.patch.txt`.
3) Ejecuta la migración en tu base:
   - Render → Database → Psql → pega `002_device_block_state.sql`
4) En Render agrega `TASK_SECRET` (en Web y Cron).
5) Crea un Cron cada 5 min que pegue a:
   ```
   curl -s -X POST https://TU-APP.onrender.com/tasks/run-scheduler -H "Authorization: Bearer $TASK_SECRET"
   ```

## Prueba manual
```
curl -s -X POST https://TU-APP.onrender.com/tasks/run-scheduler \
  -H "Authorization: Bearer $TASK_SECRET"
```
