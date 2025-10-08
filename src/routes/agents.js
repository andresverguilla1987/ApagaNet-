cat > src/routes/agents.js <<'EOF'
/*
 src/routes/agents.js  (DB-backed con fallback en memoria)
 Añade rutas /devices y /modem-compat (devuelve latest por defecto).
*/
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

// helper to fetch latest modem report (DB then fallback)
async function fetchLatestModemReport(agentId) {
  try {
    const q = `SELECT id, agent_id, gateway, http, decision, created_at
               FROM agent_modem_reports WHERE agent_id=$1 ORDER BY created_at DESC LIMIT 1`;
    const r = await pool.query(q, [agentId]);
    if (r.rows[0]) return { ok: true, report: r.rows[0], fallback: false };
    const fb = modemReportsFallback.get(agentId);
    if (fb) return { ok: true, report: fb, fallback: true };
    return { ok: false, error: "No encontrado" };
  } catch (e) {
    console.error("[agents] fetchLatestModemReport DB error:", e?.message ?? e);
    const fb = modemReportsFallback.get(agentId);
    if (fb) return { ok: true, report: fb, fallback: true };
    return { ok: false, error: "Server error (DB)" , detail: String(e?.message ?? e)};
  }
}

// helper to fetch latest devices report (DB then fallback)
async function fetchLatestDeviceReport(agentId) {
  try {
    const q = `SELECT id, agent_id, devices, created_at
               FROM agent_device_reports WHERE agent_id=$1 ORDER BY created_at DESC LIMIT 1`;
    const r = await pool.query(q, [agentId]);
    if (r.rows[0]) return { ok: true, report: r.rows[0], fallback: false };
    const fb = deviceReportsFallback.get(agentId);
    if (fb) return { ok: true, report: fb, fallback: true };
    return { ok: false, error: "No encontrado" };
  } catch (e) {
    console.error("[agents] fetchLatestDeviceReport DB error:", e?.message ?? e);
    const fb = deviceReportsFallback.get(agentId);
    if (fb) return { ok: true, report: fb, fallback: true };
    return { ok: false, error: "Server error (DB)", detail: String(e?.message ?? e) };
  }
}

// debug
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

// ----- ROUTES THAT USED TO EXIST: keep them but also add base routes -----
// GET /agents/modem-compat/latest
router.get("/modem-compat/latest", async (req, res) => {
  const agentId = readAgentId(req);
  if (!agentId) return res.status(400).json({ ok: false, error: "agent_id required" });
  const out = await fetchLatestModemReport(agentId);
  if (!out.ok) return res.status(out.error === "No encontrado" ? 404 : 500).json({ ok: false, error: out.error, detail: out.detail });
  return res.json({ ok: true, report: out.report, fallback: out.fallback });
});

// GET /agents/devices/latest
router.get("/devices/latest", async (req, res) => {
  const agentId = readAgentId(req);
  if (!agentId) return res.status(400).json({ ok: false, error: "agent_id required" });
  const out = await fetchLatestDeviceReport(agentId);
  if (!out.ok) return res.status(out.error === "No encontrado" ? 404 : 500).json({ ok: false, error: out.error, detail: out.detail });
  return res.json({ ok: true, report: out.report, fallback: out.fallback });
});

// ----- NEW: base endpoints that frontend might call -----
// GET /agents/modem-compat  -> returns latest (keeps compatibility with frontends calling /modem-compat)
router.get("/modem-compat", async (req, res) => {
  // support optional ?latest=true or no param -> return latest
  const latest = (req.query.latest === "true") || !req.query.latest;
  if (!latest) return res.status(400).json({ ok: false, error: "only latest supported" });
  const agentId = readAgentId(req);
  if (!agentId) return res.status(400).json({ ok: false, error: "agent_id required" });
  const out = await fetchLatestModemReport(agentId);
  if (!out.ok) return res.status(out.error === "No encontrado" ? 404 : 500).json({ ok: false, error: out.error, detail: out.detail });
  return res.json({ ok: true, report: out.report, fallback: out.fallback });
});

// GET /agents/devices  -> returns latest
router.get("/devices", async (req, res) => {
  const latest = (req.query.latest === "true") || !req.query.latest;
  if (!latest) return res.status(400).json({ ok: false, error: "only latest supported" });
  const agentId = readAgentId(req);
  if (!agentId) return res.status(400).json({ ok: false, error: "agent_id required" });
  const out = await fetchLatestDeviceReport(agentId);
  if (!out.ok) return res.status(out.error === "No encontrado" ? 404 : 500).json({ ok: false, error: out.error, detail: out.detail });
  return res.json({ ok: true, report: out.report, fallback: out.fallback });
});

// ----- POST endpoints (unchanged) -----
// POST report-modem-compat
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

// POST report-devices
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
EOF

# commit + push
git add src/routes/agents.js
git commit -m "fix: support base routes /devices and /modem-compat (return latest) + DB-backed with fallback" || true
git push origin HEAD || echo "git push falló: revisa credenciales/remote"

echo "Hecho: archivo actualizado. Ahora reinicia el servicio en Render (Manual Restart) y prueba las rutas."
