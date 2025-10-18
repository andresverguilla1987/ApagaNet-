// src/routes/alerts-system.js
import { Router } from "express";
import { pool } from "../lib/db.js";

// Node 18+ tiene fetch global
const router = Router();

/**
 * POST /alerts   (protegido con TASK_SECRET en server.js)
 * Body: { level?, title, message?, home_id, device_id?, metadata? }
 */
router.post("/alerts", async (req, res) => {
  try {
    const { level = "warn", title, message, home_id, device_id, metadata = {} } = req.body || {};
    if (!title || !home_id) {
      return res.status(400).json({ ok:false, error:"title y home_id requeridos" });
    }
    const q = `
      INSERT INTO alerts(level, title, message, home_id, device_id, metadata)
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING *`;
    const r = await pool.query(q, [level, title, message || null, home_id, device_id || null, metadata]);
    return res.json({ ok:true, alert:r.rows[0] });
  } catch (e) {
    console.error("alerts error:", e);
    return res.status(500).json({ ok:false, error:"server error" });
  }
});

/**
 * POST /admin/notifications/dispatch   (protegido con TASK_SECRET)
 * Body opcional: { home_id?, minutes?, limit? }
 */
router.post("/admin/notifications/dispatch", async (req, res) => {
  const { home_id, minutes = 10, limit = 20 } = req.body || {};
  try {
    const params = [Number(minutes)||10, Number(limit)||20];
    let where = "created_at > now() - ($1::int || ' minutes')::interval";
    if (home_id) { where += " AND home_id = $3"; params.push(String(home_id)); }

    const { rows: alerts } = await pool.query(
      `SELECT * FROM alerts WHERE ${where} ORDER BY created_at DESC LIMIT $2`,
      params
    );

    const sent = [];

    for (const a of alerts) {
      const { rows: subs } = await pool.query(
        `SELECT id, type, email, endpoint_url
           FROM alert_subscriptions
          WHERE active = true AND home_id = $1`,
        [a.home_id]
      );

      for (const s of subs) {
        if (s.type === "webhook" && s.endpoint_url) {
          try {
            const resp = await fetch(s.endpoint_url, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ type: "alert", alert: a }),
            });
            sent.push({ alert_id: a.id, sub_id: s.id, kind: "webhook", status: resp.status });
          } catch (err) {
            sent.push({ alert_id: a.id, sub_id: s.id, kind: "webhook", error: String(err) });
          }
        } else if (s.type === "email" && s.email) {
          // Placeholder: en Fase 3 conectamos SMTP real.
          sent.push({ alert_id: a.id, sub_id: s.id, kind: "email", status: "queued" });
        }
      }
    }

    return res.json({ ok:true, count_alerts: alerts.length, sent });
  } catch (e) {
    console.error("dispatch error:", e);
    return res.status(500).json({ ok:false, error:"server error" });
  }
});

export default router;
