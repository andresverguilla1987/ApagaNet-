// src/routes/notifications.js
import { Router } from "express";
import { pool } from "../lib/db.js";

const router = Router();

/**
 * POST /notifications/subscriptions
 * Body: { type: 'email'|'webhook', email?, endpoint_url?, home_id }
 */
router.post("/notifications/subscriptions", async (req, res) => {
  try {
    const { type, email, endpoint_url, home_id } = req.body || {};
    if (!type || !home_id) {
      return res.status(400).json({ ok:false, error:"type y home_id requeridos" });
    }
    if (type === "email" && !email) {
      return res.status(400).json({ ok:false, error:"email requerido" });
    }
    if (type === "webhook" && !endpoint_url) {
      return res.status(400).json({ ok:false, error:"endpoint_url requerido" });
    }

    const q = `
      INSERT INTO alert_subscriptions(type, email, endpoint_url, home_id)
      VALUES ($1,$2,$3,$4)
      ON CONFLICT DO NOTHING
      RETURNING *`;
    const r = await pool.query(q, [type, email || null, endpoint_url || null, home_id]);
    return res.json({ ok:true, subscription: r.rows[0] || { note:"ya existía por índice único" } });
  } catch (e) {
    console.error("subscriptions error:", e);
    return res.status(500).json({ ok:false, error:"server error" });
  }
});

export default router;
