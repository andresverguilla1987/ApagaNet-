-- scripts/dedupe_subscriptions.sql
-- 🔧 Limpieza rápida de suscripciones duplicadas (webhooks / emails)
-- Deja solo la más reciente por (home_id, email/url)
-- Ejecutar una vez, seguro y reversible con backups automáticos de Render

BEGIN;

-- 🧹 Eliminar duplicadas EMAIL (mantiene la más nueva)
DELETE FROM alert_subscriptions a
USING alert_subscriptions b
WHERE a.type='email' AND b.type='email'
  AND a.home_id = b.home_id
  AND LOWER(a.email) = LOWER(b.email)
  AND a.id < b.id;

-- 🧹 Eliminar duplicadas WEBHOOK (mantiene la más nueva)
DELETE FROM alert_subscriptions a
USING alert_subscriptions b
WHERE a.type='webhook' AND b.type='webhook'
  AND a.home_id = b.home_id
  AND a.endpoint_url = b.endpoint_url
  AND a.id < b.id;

-- 🧱 Índices únicos para evitar duplicados futuros
CREATE UNIQUE INDEX IF NOT EXISTS uq_alert_sub_email_home
  ON alert_subscriptions (home_id, LOWER(email))
  WHERE type='email';

CREATE UNIQUE INDEX IF NOT EXISTS uq_alert_sub_webhook_home
  ON alert_subscriptions (home_id, endpoint_url)
  WHERE type='webhook';

COMMIT;

-- ✅ Verificación final
SELECT type, home_id, COUNT(*) AS total,
       COUNT(DISTINCT email) AS uniq_emails,
       COUNT(DISTINCT endpoint_url) AS uniq_hooks
FROM alert_subscriptions
GROUP BY type, home_id
ORDER BY type;
