/**
 * routes/email.js
 * Admin endpoints to verify and test SMTP, and to demo an alert email.
 * Protect with TASK_SECRET (x-admin-secret header).
 */
const express = require('express');
const router = express.Router();
const { verify, sendTest, sendAlertEmail } = require('../email/mailer');

function requireAdmin(req, res, next){
  const got = req.get('x-admin-secret');
  if (!process.env.TASK_SECRET || got !== process.env.TASK_SECRET){
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

router.get('/verify', requireAdmin, async (req, res)=>{
  try {
    const ok = await verify();
    res.json({ ok: true, info: ok });
  } catch(e){
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

router.post('/test', requireAdmin, async (req, res)=>{
  const { to } = req.body || {};
  if (!to) return res.status(400).json({ error: 'Missing to' });
  try {
    const info = await sendTest(to);
    res.json({ ok: true, id: info?.messageId });
  } catch(e){
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

router.post('/alert-demo', requireAdmin, async (req, res)=>{
  const { to, title, level='warning', deviceName='Dispositivo', timeISO=new Date().toISOString(), detailsUrl='https://apaganet.example/app/alerts/1' } = req.body || {};
  if (!to) return res.status(400).json({ error: 'Missing to' });
  try {
    const info = await sendAlertEmail(to, { title: title || 'Actividad inusual detectada', level, deviceName, timeISO, detailsUrl });
    res.json({ ok: true, id: info?.messageId });
  } catch(e){
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

module.exports = router;
