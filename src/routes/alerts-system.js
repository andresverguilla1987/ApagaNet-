// src/routes/alerts-system.js (ESM)
// CRUD básico de alertas para agentes/cron (protegido por TASK_SECRET en server.js)

import express from "express";
import { pool } from "../lib/db.js";

let notify = null;
try {
  notify = (await import("../services/notify.js")).default
        || (await import("../services/notify.js"));
} catch {}

const router = express.Router();

const toLimit = (v) => Math.max(1, Math.min(200, Number(v) || 50));
const toSince = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
};

// Crear alerta y encolar notificación
router.post("/", async (req, res) => {
  try {
    const {
      level = "info",                 // "info" | "warn" | "critical"
      title,
      message = null,
      home_id = null,
      device_id = null,
      metadata = {}
    } = req.body || {};

    if (!title || !String(title).trim()) return res.status(400).json({ error: "title is required" });
    if (!["info","warn","critical"].includes(level)) return res.status(400).json({ error: "invalid level" });

    const q = `insert into alerts (id, user_id, home_id, device_id, level, title, message, metadata)
               values (gen_random_uuid(), null, $1, $2, $3, $4, $5, $6::jsonb)
               returning *`;
    const { rows } = await pool.query(q, [home_id, device_id, level, title, message, JSON.stringify(metadata)]);
    const alert = rows[0];

    if (notify?.enqueueAlert) {
      try { await notify.enqueueAlert(alert); } catch (e) { console.warn("[notify] enqueue", e.message); }
    }
    res.status(201).json(alert);
  } catch (e) {
    console.error("POST /alerts", e);
    res.status(500).json({ error: "internal_error" });
  }
});

// Listar alertas
router.get("/", async (req, res) => {
  try {
    const { home_id, device_id, unread, since, limit } = req.query;
    const lim = toLimit(limit);
    const sinceIso = toSince(since);
    const where = [], p = [];
    if (home_id)  { where.push(`home_id=$${p.length+1}`);  p.push(home_id); }
    if (device_id){ where.push(`device_id=$${p.length+1}`);p.push(device_id); }
    if (unread === "1" || unread === "true") where.push("read_at is null");
    if (sinceIso) { where.push(`created_at >= $${p.length+1}`); p.push(sinceIso); }
    const sql = `select * from alerts ${where.length?"where "+where.join(" and "):""} order by created_at desc limit ${lim}`;
    const { rows } = await pool.query(sql, p);
    res.json(rows);
  } catch (e) {
    console.error("GET /alerts", e);
    res.status(500).json({ error: "internal_error" });
  }
});

// Ver una alerta
router.get("/:id", async (req, res) => {
  try {
    const { rows } = await pool.query("select * from alerts where id=$1", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "not_found" });
    res.json(rows[0]);
  } catch (e) {
    console.error("GET /alerts/:id", e);
    res.status(500).json({ error: "internal_error" });
  }
});

// Marcar leída / no leída
router.patch("/:id/read", async (req, res) => {
  try {
    const { read } = req.body || {};
    if (typeof read !== "boolean") return res.status(400).json({ error: "read boolean required" });
    const { rows } = await pool.query(
      `update alerts set read_at=${read ? "now()" : "null"} where id=$1 returning *`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "not_found" });
    res.json(rows[0]);
  } catch (e) {
    console.error("PATCH /alerts/:id/read", e);
    res.status(500).json({ error: "internal_error" });
  }
});

// Editar
router.put("/:id", async (req, res) => {
  try {
    const { level, title, message, metadata } = req.body || {};
    const { rows: cur } = await pool.query("select * from alerts where id=$1", [req.params.id]);
    const row = cur[0]; if (!row) return res.status(404).json({ error: "not_found" });

    const newLevel = level ?? row.level;
    if (!["info","warn","critical"].includes(newLevel)) return res.status(400).json({ error: "invalid level" });
    const newTitle = title ?? row.title;
    if (!newTitle || !String(newTitle).trim()) return res.status(400).json({ error: "title is required" });
    const newMessage = message ?? row.message;
    const newMetadata = (metadata !== undefined) ? JSON.stringify(metadata) : JSON.stringify(row.metadata);

    const { rows: upd } = await pool.query(
      "update alerts set level=$2,title=$3,message=$4,metadata=$5::jsonb where id=$1 returning *",
      [req.params.id, newLevel, newTitle, newMessage, newMetadata]
    );
    res.json(upd[0]);
  } catch (e) {
    console.error("PUT /alerts/:id", e);
    res.status(500).json({ error: "internal_error" });
  }
});

// Borrar
router.delete("/:id", async (req, res) => {
  try {
    const { rowCount } = await pool.query("delete from alerts where id=$1", [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: "not_found" });
    res.json({ ok: true });
  } catch (e) {
    console.error("DELETE /alerts/:id", e);
    res.status(500).json({ error: "internal_error" });
  }
});

export default router;
