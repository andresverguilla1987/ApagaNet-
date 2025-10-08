// src/routes/agents.js  (STUB robusto - memoria)
// Reemplaza/pega este archivo en tu repo (GitHub web editor o via shell).
import express from "express";
const router = express.Router();

// parse JSON for all routes in this router and handle parse errors
router.use(express.json({
  strict: true,
}));

// Simple agent-token middleware: if AGENT_TOKEN env var is set, require it
function requireAgentToken(req, res, next) {
  const expected = process.env.AGENT_TOKEN || "";
  if (!expected) return next(); // no token configured -> allow (dev)
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token || token !== expected) {
    return res.status(401).json({ ok: false, error: "No autorizado (agent token)" });
  }
  return next();
}

// helper: read agent id from query or body, default to "1" (keeps compatibility)
function readAgentId(req) {
  return String(req.query.agent_id || req.query.agent || req.body?.agent_id || req.body?.agent || "1");
}

// in-memory stores (temporary)
const modemReports = new Map();   // agent_id -> report
const deviceReports = new Map();  // agent_id -> report

// health / debug route (optional)
router.get("/_debug", (_req, res) => {
  res.json({
    ok: true,
    modemReports: modemReports.size,
    deviceReports: deviceReports.size,
  });
});

// GET latest modem compatibility report
router.get("/modem-compat/latest", (req, res) => {
  try {
    const agentId = readAgentId(req);
    console.debug(`[agents] GET /modem-compat/latest agent=${agentId}`);
    const report = modemReports.get(agentId);
    if (!report) return res.status(404).json({ ok: false, error: "No encontrado" });
    return res.json({ ok: true, report });
  } catch (e) {
    console.error("[agents] modem-compat/latest error:", e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// GET latest devices report
router.get("/devices/latest", (req, res) => {
  try {
    const agentId = readAgentId(req);
    console.debug(`[agents] GET /devices/latest agent=${agentId}`);
    const report = deviceReports.get(agentId);
    if (!report) return res.status(404).json({ ok: false, error: "No encontrado" });
    return res.json({ ok: true, report });
  } catch (e) {
    console.error("[agents] devices/latest error:", e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// POST report-modem-compat (agents in LAN should POST here)
router.post("/report-modem-compat", requireAgentToken, (req, res) => {
  try {
    const body = req.body || {};
    const agentId = readAgentId(req);
    // basic validation
    if (!agentId) return res.status(400).json({ ok: false, error: "agent_id required" });
    const now = new Date().toISOString();
    const stored = {
      agent_id: agentId,
      gateway: body.gateway || null,
      http: Array.isArray(body.http) ? body.http : [],
      decision: body.decision || {},
      created_at: now,
    };
    modemReports.set(agentId, stored);
    console.debug(`[agents] POST /report-modem-compat stored agent=${agentId}`);
    return res.json({ ok: true, stored });
  } catch (e) {
    console.error("[agents] report-modem-compat error:", e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// POST report-devices
router.post("/report-devices", requireAgentToken, (req, res) => {
  try {
    const body = req.body || {};
    const agentId = readAgentId(req);
    if (!agentId) return res.status(400).json({ ok: false, error: "agent_id required" });
    const now = new Date().toISOString();
    const stored = {
      agent_id: agentId,
      devices: Array.isArray(body.devices) ? body.devices : [],
      created_at: now,
    };
    deviceReports.set(agentId, stored);
    console.debug(`[agents] POST /report-devices stored agent=${agentId}`);
    return res.json({ ok: true, stored });
  } catch (e) {
    console.error("[agents] report-devices error:", e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

export default router;
