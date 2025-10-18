
// src/routes/notifications.pro.js (ESM)
import express from 'express';
import { pool } from '../lib/db.js';
import jwt from 'jsonwebtoken';
const router = express.Router();
router.use(express.json({ limit: '1mb' }));

function requireJWT(req,res,next){
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ ok:false, error:"No token" });
  try{ req.user = jwt.verify(token, process.env.JWT_SECRET || "dev-secret"); next(); }
  catch{ return res.status(401).json({ ok:false, error:"Invalid token" }); }
}
function requireTaskSecret(req,res,next){
  const expected = (process.env.TASK_SECRET || "").trim();
  const h = req.headers.authorization || "";
  const bearer = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  const headerAlt = (req.headers["x-task-secret"] || "").toString().trim();
  const provided = bearer || headerAlt;
  if (!expected || !provided || provided !== expected) return res.status(401).json({ ok:false, error:"unauthorized" });
  next();
}

// Create
router.post('/notifications/subscriptions', requireJWT, async (req,res)=>{
  try{
    const userId = req.user?.id || null;
    const { channel='email', address, levels=['critical'], quietHours, tz } = req.body || {};
    if (!address) return res.status(400).json({ ok:false, error:'Missing address' });
    const qh_from = quietHours?.from || null;
    const qh_to   = quietHours?.to   || null;
    const timezone = quietHours?.tz || tz || null;
    const r = await pool.query(
      `INSERT INTO notification_subscriptions
         (user_id, channel, address, levels, quiet_from, quiet_to, tz)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid), channel, address)
       DO UPDATE SET levels=EXCLUDED.levels, quiet_from=EXCLUDED.quiet_from, quiet_to=EXCLUDED.quiet_to, tz=EXCLUDED.tz, updated_at=now()
       RETURNING id`,
      [userId, channel, address, levels, qh_from, qh_to, timezone]
    );
    res.status(201).json({ ok:true, id:r.rows[0].id });
  }catch(e){ res.status(500).json({ ok:false, error:e?.message || String(e) }); }
});

// List
router.get('/notifications/subscriptions', requireJWT, async (req,res)=>{
  try{
    const userId = req.user?.id || null;
    const r = await pool.query(
      `SELECT id, channel, address, levels, quiet_from as "quietFrom", quiet_to as "quietTo", tz
         FROM notification_subscriptions
        WHERE user_id = $1
        ORDER BY created_at DESC`,
      [userId]
    );
    res.json({ ok:true, items:r.rows });
  }catch(e){ res.status(500).json({ ok:false, error:e?.message || String(e) }); }
});

// Update
router.patch('/notifications/subscriptions/:id', requireJWT, async (req,res)=>{
  try{
    const userId = req.user?.id || null;
    const { id } = req.params;
    const { levels, quietHours, tz } = req.body || {};
    const qh_from = quietHours?.from || null;
    const qh_to   = quietHours?.to   || null;
    const timezone = quietHours?.tz || tz || null;
    const r = await pool.query(
      `UPDATE notification_subscriptions
          SET levels = COALESCE($1, levels),
              quiet_from = COALESCE($2, quiet_from),
              quiet_to = COALESCE($3, quiet_to),
              tz = COALESCE($4, tz),
              updated_at = now()
        WHERE id = $5 AND user_id = $6
        RETURNING id`,
      [levels || null, qh_from, qh_to, timezone, id, userId]
    );
    if (r.rowCount === 0) return res.status(404).json({ ok:false, error:'Not found' });
    res.json({ ok:true, id });
  }catch(e){ res.status(500).json({ ok:false, error:e?.message || String(e) }); }
});

// Delete
router.delete('/notifications/subscriptions/:id', requireJWT, async (req,res)=>{
  try{
    const userId = req.user?.id || null;
    const { id } = req.params;
    const r = await pool.query(`DELETE FROM notification_subscriptions WHERE id=$1 AND user_id=$2`, [id, userId]);
    if (r.rowCount === 0) return res.status(404).json({ ok:false, error:'Not found' });
    res.json({ ok:true, id });
  }catch(e){ res.status(500).json({ ok:false, error:e?.message || String(e) }); }
});

// Admin dispatch
router.post('/admin/notifications/dispatch', requireTaskSecret, async (req,res)=>{
  try{
    const { title='Notificación', level='info', body='', link='', filter } = req.body || {};
    const byLevels = filter?.byLevels || null;
    const byChannel = filter?.byChannel || ['email'];
    const subs = await pool.query(
      `SELECT user_id, channel, address, levels, tz, quiet_from, quiet_to
         FROM notification_subscriptions
        WHERE channel = ANY($1)`,
      [byChannel]
    );

    let enqueueEmail, makeDedupeKey, hasOutbox = false;
    try{
      const mod = await import('../lib/emailQueue.js');
      enqueueEmail = mod.enqueueEmail; makeDedupeKey = mod.makeDedupeKey;
      hasOutbox = !!(enqueueEmail && makeDedupeKey);
    }catch{}

    let sendAlertEmail;
    if (!hasOutbox){
      const mailerPkg = await import('../../email/mailer.js');
      sendAlertEmail = (mailerPkg.default || mailerPkg).sendAlertEmail;
    }

    let delivered = 0;
    for (const s of subs.rows){
      if (byLevels && !byLevels.some(l => (s.levels || []).includes(l))) continue;
      // quiet hours (simple local-time cut)
      if (s.quiet_from && s.quiet_to && s.tz){
        try{
          const now = new Date().toLocaleTimeString('en-GB', { hour12:false, hour:'2-digit', minute:'2-digit', timeZone:s.tz }).slice(0,5);
          const a = s.quiet_from.slice(0,5), b = s.quiet_to.slice(0,5);
          const between = (x)=> (a<=b) ? (x>=a && x<=b) : (x>=a || x<=b);
          if (between(now)) continue;
        }catch{}
      }
      if (s.channel === 'email'){
        const payload = { title, level, deviceName:'ApagaNet', timeISO:new Date().toISOString(), detailsUrl:link || '' };
        if (hasOutbox){
          const dedupeKey = makeDedupeKey({ to:s.address, template:'alert', payload:{ title, level, link } });
          await enqueueEmail({ to:s.address, subject:`[ApagaNet] ${level}: ${title}`, template:'alert', payload, dedupeKey });
          delivered++;
        }else{
          await sendAlertEmail(s.address, payload);
          delivered++;
        }
      }
    }
    res.json({ ok:true, delivered });
  }catch(e){ res.status(500).json({ ok:false, error:e?.message || String(e) }); }
});

export default router;
