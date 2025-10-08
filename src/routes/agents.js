// src/routes/agents.js
import express from "express";
import { pool } from "../lib/db.js";

const router = express.Router();

/**
 * Mantengo los endpoints que ya tenías:
 * GET  /next-actions
 * POST /report
 */
router.get("/next-actions", async (req, res) => {
  try {
    const homeId = req.query.homeId || req.query.home_id || req.query.home;
    if (!homeId) return res.status(400).json({ ok: false, error: "homeId required" });
    // Placeholder: devuelve acciones vacías (puedes implementar lógica real luego)
    res.json({ ok: true, homeId, actions: [] });
  } catch (e) {
    console.error("next-actions error:", e);
    res.status(500).json({ ok: false, error: String(e) });
  }
});

router.post("/report", async (req, res) => {
  try {
    // Endpoint genérico de report (no usado por tester) — devolvemos conteo si viene events
    const count = (req.body?.events || []).length || 0;
    res.json({ ok: true, stored: count });
  } catch (e) {
    console.error("report error:", e);
    res.status(500).json({ ok: false, error: String(e) });
  }
});

/**
 * GET latest modem compatibility report for an agent
 * GET /agents/modem-compat/latest?agent_id=1
 */
router.get("/modem-compat/latest", async (req, res) => {
  try {
    const agentId = String(req.query.agent_id || req.query.agent || "");
    if (!agentId) return res.status(400).json({ ok: false, error: "agent_id required" });

    const q = `SELECT id, agent_id, gateway, http, decision, created_at
               FROM agent_modem_reports
               WHERE agent_id = $1
               ORDER BY created_at DESC
               LIMIT 1`;
    const r = await pool.query(q, [agentId]);
    if (!r.rows[0]) return res.status(404).json({ ok: false, error: "No encontrado" });
    return res.json({ ok: true, report: r.rows[0] });
  } catch (e) {
    console.error("modem-compat/latest error:", e);
    res.status(500).json({ ok: false, error: String(e) });
  }
});

/**
 * GET latest devices report for an agent
 * GET /agents/devices/latest?agent_id=1
 */
router.get("/devices/latest", async (req, res) => {
  try {
    const agentId = String(req.query.agent_id || req.query.agent || "");
    if (!agentId) return res.status(400).json({ ok: false, error: "agent_id required" });

    const q = `SELECT id, agent_id, devices, created_at
               FROM agent_device_reports
               WHERE agent_id = $1
               ORDER BY created_at DESC
               LIMIT 1`;
    const r = await pool.query(q, [agentId]);
    if (!r.rows[0]) return res.status(404).json({ ok: false, error: "No encontrado" });
    return res.json({ ok: true, report: r.rows[0] });
  } catch (e) {
    console.error("devices/latest error:", e);
    res.status(500).json({ ok: false, error: String(e) });
  }
});

/**
 * POST report-modem-compat
 * body: { agent_id, gateway, http: [...], decision: {...} }
 */
router.post("/report-modem-compat", express.json(), async (req, res) => {
  try {
    const body = req.body || {};
    const agentId = String(body.agent_id || body.agent || "");
    if (!agentId) return res.status(400).json({ ok: false, error: "agent_id required" });

    const q = `INSERT INTO agent_modem_reports(agent_id, gateway, http, decision)
               VALUES ($1, $2, $3::jsonb, $4::jsonb)
               RETURNING id, created_at`;
    const vals = [
      agentId,
      body.gateway || null,
      JSON.stringify(body.http || []),
      JSON.stringify(body.decision || {}),
    ];
    const r = await pool.query(q, vals);
    return res.json({ ok: true, id: r.rows[0].id, created_at: r.rows[0].created_at });
  } catch (e) {
    console.error("report-modem-compat error:", e);
    res.status(500).json({ ok: false, error: String(e) });
  }
});

/**
 * POST report-devices
 * body: { agent_id, devices: [...] }
 */
router.post("/report-devices", express.json(), async (req, res) => {
  try {
    const body = req.body || {};
    const agentId = String(body.agent_id || body.agent || "");
    if (!agentId) return res.status(400).json({ ok: false, error: "agent_id required" });

    const q = `INSERT INTO agent_device_reports(agent_id, devices)
               VALUES ($1, $2::jsonb)
               RETURNING id, created_at`;
    const vals = [agentId, JSON.stringify(body.devices || [])];
    const r = await pool.query(q, vals);
    return res.json({ ok: true, id: r.rows[0].id, created_at: r.rows[0].created_at });
  } catch (e) {
    console.error("report-devices error:", e);
    res.status(500).json({ ok: false, error: String(e) });
  }
});

export default router;
