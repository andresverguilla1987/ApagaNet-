// src/routes/alerts.enqueued.js (ESM)
// Alerts router integrated with Email Outbox dedupe/outbox
import express from 'express';
import { pool } from '../lib/db.js';
import { enqueueEmail, makeDedupeKey } from '../lib/emailQueue.js';

const router = express.Router();
router.use(express.json({ limit: '1mb' }));

/**
 * Assumptions:
 * - Table `alerts` exists with columns: id (uuid default), user_id, device_id, level, title, created_at, read_at (nullable)
 * - req.user has fields: id, email (from your JWT)
 * Adjust queries if your schema differs.
 */

// List alerts for current user
router.get('/alerts', async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ ok: false, error: 'No user in token' });
  try {
    const r = await pool.query(
      `SELECT id, user_id, device_id, level, title, created_at, read_at
         FROM alerts
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 200`,
      [userId]
    );
    res.json({ ok: true, items: r.rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// Create alert and enqueue email (idempotent by alert id)
router.post('/alerts', async (req, res) => {
  const user = req.user || {};
  const userId = user.id;
  const userEmail = user.email; // prefer token email to avoid extra query
  if (!userId) return res.status(401).json({ ok: false, error: 'No user in token' });

  const { device_id, level='info', title='Nueva alerta', details_url } = req.body || {};
  if (!device_id) return res.status(400).json({ ok: false, error: 'Missing device_id' });

  try {
    const ins = await pool.query(
      `INSERT INTO alerts (user_id, device_id, level, title, created_at)
       VALUES ($1,$2,$3,$4, now())
       RETURNING id, created_at`,
      [userId, device_id, level, title]
    );
    const alert = ins.rows[0];

    // Build email payload
    const payload = {
      title,
      level,
      deviceName: req.body?.device_name || 'Dispositivo',
      timeISO: new Date(alert.created_at).toISOString(),
      detailsUrl: details_url || `${process.env.PUBLIC_APP_URL || ''}/alerts/${alert.id}`
    };

    // Determine recipient
    let to = userEmail;
    if (!to) {
      // optional fallback to users table if token has no email
      const qr = await pool.query('SELECT email FROM users WHERE id=$1 LIMIT 1', [userId]);
      to = qr.rows?.[0]?.email || null;
    }

    if (to) {
      const dedupeKey = makeDedupeKey({ to, template: 'alert', alertId: alert.id });
      await enqueueEmail({
        to,
        subject: `[ApagaNet] ${payload.level}: ${payload.title}`,
        template: 'alert',
        payload,
        dedupeKey
      });
    }

    res.status(201).json({ ok: true, id: alert.id });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// Mark as read
router.patch('/alerts/:id/read', async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ ok: false, error: 'No user in token' });
  const { id } = req.params;
  try {
    const up = await pool.query(
      `UPDATE alerts SET read_at = now()
         WHERE id = $1 AND user_id = $2
       RETURNING id, read_at`,
      [id, userId]
    );
    if (up.rowCount === 0) return res.status(404).json({ ok: false, error: 'Not found' });
    res.json({ ok: true, id, read_at: up.rows[0].read_at });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

export default router;
