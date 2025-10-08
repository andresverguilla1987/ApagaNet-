cat > src/routes/agents.js <<'EOF'
/*
 src/routes/agents.js  (DB-backed)
 Persistencia en Postgres: agent_modem_reports, agent_device_reports
*/
import express from "express";
import { pool } from "../lib/db.js";
const router = express.Router();

// parse JSON
router.use(express.json());

// require AGENT_TOKEN if set
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

// helper: read agent id
function readAgentId(req) {
  return String(req.query.agent_id || req.query.agent || req.body?.agent_id || req.body?.agent || "");
}

// GET latest modem-compat
router.get("/modem-compat/latest", async (req, res) => {
  try {
    const agentId = readAgentId(req);
    if (!agentId) return res.status(400).json({ ok: false, error: "agent_id required" });
    const q = `SELECT id, agent_id, gateway, http, decision, created_at
               FROM agent_modem_reports WHERE agent_id=$1 ORDER BY created_at DESC LIMIT 1`;
    const r = await pool.query(q, [agentId]);
    if (!r.rows[0]) return res.status(404).json({ ok: false, error: "No encontrado" });
    return res.json({ ok: true, report: r.rows[0] });
  } catch (e) {
    console.error("modem-compat/latest error:", e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// GET latest devices report
router.get("/devices/latest", async (req, res) => {
  try {
    const agentId = readAgentId(req);
    if (!agentId) return res.status(400).json({ ok: false, error: "agent_id required" });
    const q = `SELECT id, agent_id, devices, created_at
               FROM agent_device_reports WHERE agent_id=$1 ORDER BY created_at DESC LIMIT 1`;
    const r = await pool.query(q, [agentId]);
    if (!r.rows[0]) return res.status(404).json({ ok: false, error: "No encontrado" });
    return res.json({ ok: true, report: r.rows[0] });
  } catch (e) {
    console.error("devices/latest error:", e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// POST report-modem-compat
router.post("/report-modem-compat", requireAgentToken, async (req, res) => {
  try {
    const body = req.body || {};
    const agentId = String(body.agent_id || "");
    if (!agentId) return res.status(400).json({ ok: false, error: "agent_id required" });
    const q = `INSERT INTO agent_modem_reports(agent_id, gateway, http, decision)
               VALUES ($1,$2,$3::jsonb,$4::jsonb) RETURNING id, created_at`;
    const vals = [agentId, body.gateway || null, JSON.stringify(body.http || []), JSON.stringify(body.decision || {})];
    const r = await pool.query(q, vals);
    return res.json({ ok: true, id: r.rows[0].id, created_at: r.rows[0].created_at });
  } catch (e) {
    console.error("report-modem-compat error:", e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// POST report-devices
router.post("/report-devices", requireAgentToken, async (req, res) => {
  try {
    const body = req.body || {};
    const agentId = String(body.agent_id || "");
    if (!agentId) return res.status(400).json({ ok: false, error: "agent_id required" });
    const q = `INSERT INTO agent_device_reports(agent_id, devices)
               VALUES ($1,$2::jsonb) RETURNING id, created_at`;
    const vals = [agentId, JSON.stringify(body.devices || [])];
    const r = await pool.query(q, vals);
    return res.json({ ok: true, id: r.rows[0].id, created_at: r.rows[0].created_at });
  } catch (e) {
    console.error("report-devices error:", e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

export default router;
EOF

# git add/commit/push (ajusta branch si usas otro)
git add src/routes/agents.js
git commit -m "feat: agents DB-backed (persist reports in Postgres)" || true
git push origin HEAD || echo "git push falló: revisa credenciales/remote"
