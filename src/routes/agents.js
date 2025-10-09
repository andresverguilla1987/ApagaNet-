// src/routes/agents.js  (DB-backed con fallback en memoria)
import express from "express";
import { pool } from "../lib/db.js";
const router = express.Router();

router.use(express.json({ limit: "1mb" }));

const modemReportsFallback = new Map();
const deviceReportsFallback = new Map();

function requireAgentToken(req, res, next) {
  const expected = process.env.AGENT_TOKEN || "";
  if (!expected) return next();
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token || token !== expected) {
    return res.status(401).json({ ok: false, error: "No autorizado (agent token)" });
  }
  return next();
}

function readAgentId(req) {
  return String(req.query.agent_id || req.query.agent || req.body?.agent_id || req.body?.agent || "1");
}

router.get("/_debug", (_req, res) => {
  res.json({
    ok: true,
    fallback: {
      modemReports: modemReportsFallback.size,
      deviceReports: deviceReportsFallback.size,
    },
    env: {
      hasAgentToken: !!process.env.AGENT_TOKEN,
    },
  });
});

router.get("/modem-compat/latest", async (req, res) => {
  const agentId = readAgentId(req);
  if (!agentId) return res.status(400).json({ ok: false, error: "agent_id required" });
  try {
    const q = `SELECT id, agent_id, gateway, http, decision, created_at
               FROM agent_modem_reports WHERE agent_id=$1
               ORDER BY created_at DESC LIMIT 1`;
    const r = await pool.query(q, [agentId]);
    if (!r.rows[0]) {
      const fb = modemReportsFallback.get(agentId);
      if (fb) return res.json({ ok: true, report: fb, fallback: true });
      return res.status(404).json({ ok: false, error: "No encontrado" });
    }
    return res.json({ ok: true, report: r.rows[0], fallback: false });
  } catch (e) {
    console.error("[agents] modem-compat/latest DB error:", e?.message ?? e);
    const fb = modemReportsFallback.get(agentId);
    if (fb) return res.json({ ok: true, report: fb, fallback: true });
    return res.status(500).json({ ok: false, error: "Server error (DB)", detail: String(e?.message ?? e) });
  }
});

router.get("/devices/latest", async (req, res) => {
  const agentId = readAgentId(req);
  if (!agentId) return res.status(400).json({ ok: false, error: "agent_id required" });
  try {
    const q = `SELECT id, agent_id, devices, created_at
               FROM agent_device_reports WHERE agent_id=$1
               ORDER BY created_at DESC LIMIT 1`;
    const r = await pool.query(q, [agentId]);
    if (!r.rows[0]) {
      const fb = deviceReportsFallback.get(agentId);
      if (fb) return res.json({ ok: true, report: fb, fallback: true });
      return res.status(404).json({ ok: false, error: "No encontrado" });
    }
    return res.json({ ok: true, report: r.rows[0], fallback: false });
  } catch (e) {
    console.error("[agents] devices/latest DB error:", e?.message ?? e);
    const fb = deviceReportsFallback.get(agentId);
    if (fb) return res.json({ ok: true, report: fb, fallback: true });
    return res.status(500).json({ ok: false, error: "Server error (DB)", detail: String(e?.message ?? e) });
  }
});

router.post("/report-modem-compat", requireAgentToken, async (req, res) => {
  const body = req.body || {};
  const agentId = String(body.agent_id || "1");
  if (!agentId) return res.status(400).json({ ok: false, error: "agent_id required" });
  const now = new Date().toISOString();
  const storedFallback = {
    agent_id: agentId,
    gateway: body.gateway || null,
    http: Array.isArray(body.http) ? body.http : [],
    decision: body.decision || {},
    created_at: now,
  };
  try {
    const q = `INSERT INTO agent_modem_reports(agent_id, gateway, http, decision)
               VALUES ($1,$2,$3::jsonb,$4::jsonb) RETURNING id, created_at`;
    const vals = [agentId, body.gateway || null, JSON.stringify(body.http || []), JSON.stringify(body.decision || {})];
    const r = await pool.query(q, vals);
    return res.json({ ok: true, id: r.rows[0].id, created_at: r.rows[0].created_at, fallback: false });
  } catch (e) {
    console.error("[agents] report-modem-compat DB insert failed, using fallback:", e?.message ?? e);
    modemReportsFallback.set(agentId, storedFallback);
    return res.json({ ok: true, stored: storedFallback, fallback: true, error: String(e?.message ?? e) });
  }
});

router.post("/report-devices", requireAgentToken, async (req, res) => {
  const body = req.body || {};
  const agentId = String(body.agent_id || "1");
  if (!agentId) return res.status(400).json({ ok: false, error: "agent_id required" });
  const storedFallback = {
    agent_id: agentId,
    devices: Array.isArray(body.devices) ? body.devices : [],
    created_at: new Date().toISOString(),
  };
  try {
    const q = `INSERT INTO agent_device_reports(agent_id, devices)
               VALUES ($1,$2::jsonb) RETURNING id, created_at`;
    const vals = [agentId, JSON.stringify(body.devices || [])];
    const r = await pool.query(q, vals);
    return res.json({ ok: true, id: r.rows[0].id, created_at: r.rows[0].created_at, fallback: false });
  } catch (e) {
    console.error("[agents] report-devices DB insert failed, using fallback:", e?.message ?? e);
    deviceReportsFallback.set(agentId, storedFallback);
    return res.json({ ok: true, stored: storedFallback, fallback: true, error: String(e?.message ?? e) });
  }
});

export default router;
