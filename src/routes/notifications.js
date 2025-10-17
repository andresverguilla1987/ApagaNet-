// src/routes/notifications.js (ESM)
// Suscripciones (email/webhook) y dispatch con TASK_SECRET

import express from "express";
import { pool } from "../lib/db.js";
import notify from "../services/notify.js";

const router = express.Router();

// --- helpers de auth admin (TASK_SECRET) ---
function getTaskSecret(req) {
  const h = req.headers.authorization || "";
  const bearer = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  const headerAlt = (req.headers["x-task-secret"] || "").toString().trim();
  return bearer || headerAlt;
}
function requireTask(req, res, next) {
  const provided = getTaskSecret(req);
  const expected = (process.env.TASK_SECRET || "").trim();
  if (provided && expected && provided === expected) return next();
  return res.status(401).json({ error: "unauthorized" });
}

// --- crear suscripción ---
router.post("/notifications/subscriptions", async (req, res) => {
  try {
    const {
      type,               // "email" | "webhook"
      endpoint_url = null,
      email = null,
      home_id = null,
      device_id = null,
      user_id = null,
      active = true,
    } = req.body || {};

    if (!["webhook", "email"].includes(type)) {
      return res.status(400).json({ error: "invalid type" });
    }
    if (type === "webhook" && !endpoint_url) return res.status(400).json({ error: "endpoint_url required" });
    if (type === "email" && !email) return res.status(400).json({ error: "email required" });

    const { rows } = await pool.query(
      `insert into alert_subscriptions (id, type, endpoint_url, email, home_id, device_id, user_id, active)
       values (gen_random_uuid(), $1,$2,$3,$4,$5,$6,$7)
       returning *`,
      [type, endpoint_url, email, home_id, device_id, user_id, active]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error("POST /notifications/subscriptions", e);
    res.status(500).json({ error: "internal_error" });
  }
});

// --- listar suscripciones (simple filtro) ---
router.get("/notifications/subscriptions", async (req, res) => {
  try {
    const { user_id, home_id, device_id, active } = req.query;
    const wh = [], p = [];
    if (user_id)   { wh.push(`user_id=$${p.length+1}`);   p.push(user_id); }
    if (home_id)   { wh.push(`home_id=$${p.length+1}`);   p.push(home_id); }
    if (device_id) { wh.push(`device_id=$${p.length+1}`); p.push(device_id); }
    if (active !== undefined) { wh.push(`active=$${p.length+1}`); p.push(active === "true" || active === "1"); }

    const sql = `select * from alert_subscriptions ${wh.length ? "where " + wh.join(" and ") : ""} order by created_at desc limit 200`;
    const { rows } = await pool.query(sql, p);
    res.json(rows);
  } catch (e) {
    console.error("GET /notifications/subscriptions", e);
    res.status(500).json({ error: "internal_error" });
  }
});

// --- dispatch (admin) ---
router.post("/admin/notifications/dispatch", requireTask, async (_req, res) => {
  try {
    const lim = Number(process.env.NOTIFY_BATCH_SIZE || 50);
    const r = await notify.dispatchOutboxBatch(lim);
    res.json(r);
  } catch (e) {
    console.error("POST /admin/notifications/dispatch", e);
    res.status(500).json({ error: "internal_error" });
  }
});

export default router;
