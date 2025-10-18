# ApagaNet — Dedupe de Suscripciones

Este paquete contiene un script SQL para **eliminar suscripciones duplicadas** en la tabla `alert_subscriptions`
(deja **solo la más reciente** por combinación `(home_id, email)` o `(home_id, endpoint_url)`), y además crea
**índices únicos** para prevenir duplicados futuros.

## Contenido
- `scripts/dedupe_subscriptions.sql` — Script SQL listo para ejecutar.

## Cómo usar

### Opción A: Render (Panel de la Base de Datos)
1. Abre tu servicio de **PostgreSQL** en Render.
2. Ve a **Data > SQL Console** (o similar).
3. Copia el contenido de `scripts/dedupe_subscriptions.sql` y ejecútalo.

### Opción B: psql (local)
```bash
psql "$DATABASE_URL" -f scripts/dedupe_subscriptions.sql
```

> El script hace `BEGIN/COMMIT` por sí mismo. Si algo falla, cancela y no deja cambios parciales.

## Qué hace exactamente
1. **Borra duplicados de email** (mantiene la suscripción con `id` mayor — normalmente la más nueva).
2. **Borra duplicados de webhook**.
3. **Crea índices únicos parciales**:
   - `uq_alert_sub_email_home` sobre `(home_id, LOWER(email))` cuando `type='email'`.
   - `uq_alert_sub_webhook_home` sobre `(home_id, endpoint_url)` cuando `type='webhook'`.
4. **Imprime un resumen** por tipo/home al final.

## Notas
- Si quieres conservar la más vieja, cambia la condición `a.id < b.id` por `a.created_at < b.created_at` en ambos bloques DELETE.
- Asegúrate de que tu tabla se llama **`alert_subscriptions`** y que tiene las columnas usadas (`type`, `home_id`, `email`, `endpoint_url`, `created_at`, `id`). Si cambian los nombres, ajusta el script.
