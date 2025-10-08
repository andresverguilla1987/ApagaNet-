// src/routes/agents.js  (STUB rápida - memoria)
import express from "express";
const router = express.Router();

const modemReports = new Map();
const deviceReports = new Map();

router.get("/modem-compat/latest", (req, res) => {
  const agentId = String(req.query.agent_id || req.query.agent || "1");
  const report = modemReports.get(agentId);
  if (!report) return res.status(404).json({ ok: false, error: "No encontrado" });
  res.json({ ok: true, report });
});

router.get("/devices/latest", (req, res) => {
  const agentId = String(req.query.agent_id || req.query.agent || "1");
  const report = deviceReports.get(agentId);
  if (!report) return res.status(404).json({ ok: false, error: "No encontrado" });
  res.json({ ok: true, report });
});

router.post("/report-modem-compat", express.json(), (req, res) => {
  const body = req.body || {};
  const agentId = String(body.agent_id || body.agent || "1");
  const now = new Date().toISOString();
  const stored = { agent_id: agentId, gateway: body.gateway||null, http: body.http||[], decision: body.decision||{}, created_at: now };
  modemReports.set(agentId, stored);
  res.json({ ok: true, stored });
});

router.post("/report-devices", express.json(), (req, res) => {
  const body = req.body || {};
  const agentId = String(body.agent_id || body.agent || "1");
  const now = new Date().toISOString();
  const stored = { agent_id: agentId, devices: body.devices||[], created_at: now };
  deviceReports.set(agentId, stored);
  res.json({ ok: true, stored });
});

export default router;
