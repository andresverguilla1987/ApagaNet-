// src/routes/alerts.js
import express from "express";
import { pool } from "../lib/db.js";

const router = express.Router();

// Simple middleware to require JWT if caller passed req.user earlier in stack
// (In server.js you should mount as: app.use("/alerts", requireJWT, alertsRouter))
router.get("/", async (req, res) => {
  try {
    const r = await pool.query(
      "SELECT id, device_id, kind, message, read, created_at FROM alerts ORDER BY id DESC LIMIT 100"
    );
    res.json({ ok: true, alerts: r.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "db error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { device_id, kind = "generic", message = "" } = req.body || {};
    if (!device_id) return res.status(400).json({ ok: false, error: "device_id requerido" });
    const r = await pool.query(
      "INSERT INTO alerts (device_id, kind, message) VALUES ($1,$2,$3) RETURNING id",
      [String(device_id), String(kind), String(message)]
    );
    res.status(201).json({ ok: true, id: r.rows[0].id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "db error" });
  }
});

router.patch("/:id/read", async (req, res) => {
  try {
    const id = Number(req.params.id || 0);
    const r = await pool.query("UPDATE alerts SET read=true WHERE id=$1", [id]);
    res.json({ ok: true, updated: r.rowCount });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "db error" });
  }
});

export default router;
