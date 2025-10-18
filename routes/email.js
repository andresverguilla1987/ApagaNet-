/**
 * routes/email.js (CommonJS)
 * Admin endpoints to verify/test SMTP and send an alert demo.
 * Protects with TASK_SECRET via x-admin-secret | x-task-secret | Authorization: Bearer
 */
const express = require('express');
const router = express.Router();
const { verify, sendTest, sendAlertEmail } = require('../email/mailer');

// Ensure JSON body for safety if parent app didn't add it (harmless if duplicated)
router.use(express.json({ limit: '1mb' }));

function readAdminSecret(req) {
  const bearer = (req.headers.authorization || '').startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : '';
  const h1 = req.get('x-admin-secret') || '';
  const h2 = req.get('x-task-secret') || '';
  // Trim all
  return (bearer || h1 || h2).toString().trim();
}

function requireAdmin(req, res, next) {
  const expected = (process.env.TASK_SECRET || '').toString().trim();
  if (!expected) {
    return res.status(500).json({ ok: false, error: 'TASK_SECRET no configurado' });
  }
  const provided = readAdminSecret(req);
  if (!provided) {
    return res.status(401).json({ ok: false, error: 'Falta credencial admin (x-admin-secret / x-task-secret / Bearer)' });
  }
  if (provided !== expected) {
    return res.status(401).json({ ok: false, error: 'TASK_SECRET inválido' });
  }
  return next();
}

// Opcional: rápida respuesta a preflight CORS si llega directo aquí
router.options('*', (_req, res) => res.status(204).end());

router.get('/verify', requireAdmin, async (_req, res) => {
  try {
    const info = await verify(); // nodemailer.verify()
    res.json({ ok: true, info });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

router.post('/test', requireAdmin, async (req, res) => {
  const { to } = req.body || {};
  if (!to) return res.status(400).json({ ok: false, error: 'Missing "to"' });
  try {
    const info = await sendTest(to);
    res.json({ ok: true, id: info?.messageId || null });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

router.post('/alert-demo', requireAdmin, async (req, res) => {
  const {
    to,
    title,
    level = 'warning',
    deviceName = 'Dispositivo',
    timeISO = new Date().toISOString(),
    detailsUrl = 'https://apaganet.example/app/alerts/1',
  } = req.body || {};
  if (!to) return res.status(400).json({ ok: false, error: 'Missing "to"' });
  try {
    const payload = {
      title: title || 'Actividad inusual detectada',
      level,
      deviceName,
      timeISO,
      detailsUrl,
    };
    const info = await sendAlertEmail(to, payload);
    res.json({ ok: true, id: info?.messageId || null });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

module.exports = router;
