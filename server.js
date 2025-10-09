import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import compression from "compression";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { pool } from "./src/lib/db.js";

// Routers existentes
import auth from "./src/routes/auth.js";
import devices from "./src/routes/devices.js";
import schedules from "./src/routes/schedules.js";
import agents from "./src/routes/agents.js";
import admin from "./src/routes/admin.js";

// --- App base ---
const app = express();
const PORT = Number(process.env.PORT) || 10000;
const VERSION = process.env.VERSION || "0.6.0";

// CORS
const ORIGINS = [
  ...((process.env.CORS_ORIGINS || "")
    .split(/[,\s]+/)
    .map(s => s.trim())
    .filter(Boolean)),
  "http://localhost:3000",
  "http://localhost:5173",
].filter(Boolean);

app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    if (ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error("CORS: Origin not allowed"));
  },
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization", "x-apaganet-token"],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  maxAge: 86400,
};
app.use((req, res, next) => { res.setHeader("Vary", "Origin"); next(); });
app.use(cors(corsOptions));

app.use(express.json({ limit: "1mb" }));
app.use(compression());
app.use(morgan("dev"));
app.use(rateLimit({ windowMs: 60_000, max: 200, standardHeaders: true, legacyHeaders: false }));

// --- Helpers ---
function requireJWT(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ ok: false, error: "No token" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || "dev-secret");
    next();
  } catch {
    return res.status(401).json({ ok: false, error: "Invalid token" });
  }
}
function requireTaskSecret(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token || token !== (process.env.TASK_SECRET || "")) return res.sendStatus(401);
  next();
}
async function dbPing() {
  const t0 = (globalThis.performance?.now?.() ?? Date.now());
  const r = await pool.query("select 1 as ok");
  const t1 = (globalThis.performance?.now?.() ?? Date.now());
  const latencyMs = Math.round((t1 - t0) * 1000) / 1000;
  return { ok: r.rows?.[0]?.ok === 1, latencyMs };
}

// --- Raíz ---
app.head("/", (_req, res) => res.status(200).end());
app.get("/", (_req, res) => res.send("ApagaNet API OK"));

// --- Health/Ping ---
app.get("/ping", async (_req, res) => {
  try {
    const r = await dbPing();
    res.json({ ok: true, db: r.ok, dbLatencyMs: r.latencyMs, version: VERSION });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

app.get("/api/health", async (_req, res) => {
  try {
    const startedAt = process.uptime ? Date.now() - Math.round(process.uptime() * 1000) : null;
    const { ok: dbOk, latencyMs } = await dbPing();
    res.json({
      ok: true,
      version: VERSION,
      uptimeSec: Math.round(process.uptime?.() ?? 0),
      startedAt: startedAt ? new Date(startedAt).toISOString() : null,
      db: { ok: dbOk, latencyMs },
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

app.get("/api/diag", async (_req, res) => {
  try {
    const { ok: dbOk, latencyMs } = await dbPing();
    res.json({ ok: true, db: dbOk, dbLatencyMs: latencyMs, version: VERSION, time: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// =====================================================
//  ENDPOINTS ABIERTOS PARA LA UI DE PRUEBAS (sin JWT)
// =====================================================

// 1) Compatibilidad de módem (usado por el botón "Detectar módem y equipos")
app.get("/agents/modem-compat", async (req, res) => {
  const agent_id = String(req.query.agent_id || "");
  const report = {
    id: crypto.randomUUID(),
    agent_id,
    devices: [],
    created_at: new Date().toISOString(),
  };

  try {
    await pool.query("insert into reports(id, agent_id, created_at) values ($1,$2, now())", [report.id, agent_id]);
  } catch (_) {}

  res.json({ ok: true, report, fallback: false });
});

// 2) Últimos dispositivos detectados (fallback abierto para la UI)
app.get("/agents/devices/latest", async (req, res, next) => {
  try { return next(); } catch {}
  const agent_id = String(req.query.agent_id || "");
  res.json({
    ok: true,
    report: { id: crypto.randomUUID(), agent_id, created_at: new Date().toISOString() },
    devices: [],
    fallback: true,
  });
});

// 3) Pausar / Reanudar (versiones abiertas para pruebas desde la UI)
app.post("/agents/devices/pause", async (req, res) => {
  const { agent_id, device_id, minutes = 15 } = req.body || {};
  try {
    await pool.query(
      "insert into decisions(id, agent_id, device_id, action, minutes, created_at) values ($1,$2,$3,$4,$5, now())",
      [crypto.randomUUID(), String(agent_id || ""), String(device_id || ""), "pause", Number(minutes) || 15]
    );
  } catch (_) {}
  res.json({ ok: true, applied: "pause", agent_id, device_id, minutes });
});

app.post("/agents/devices/resume", async (req, res) => {
  const { agent_id, device_id } = req.body || {};
  try {
    await pool.query(
      "insert into decisions(id, agent_id, device_id, action, created_at) values ($1,$2,$3,$4, now())",
      [crypto.randomUUID(), String(agent_id || ""), String(device_id || ""), "resume"]
    );
  } catch (_) {}
  res.json({ ok: true, applied: "resume", agent_id, device_id });
});

// =====================================================
//  Rutas existentes (se mantienen)
// =====================================================
app.use("/auth", auth);
app.use("/devices", requireJWT, devices);      // protegidas por JWT
app.use("/schedules", requireJWT, schedules);  // protegidas por JWT
app.use("/agents", agents);                    // router principal de agents
app.use("/admin", requireTaskSecret, admin);

// Tarea programada
app.post("/tasks/run-scheduler", requireTaskSecret, async (_req, res) => {
  await pool.query("insert into schedule_runs(ran_at,checked,set_blocked,set_unblocked) values (now(),0,0,0)");
  res.json({ ok: true, ranAt: new Date().toISOString() });
});

// 404 y errores
app.use((_req, res) => res.status(404).json({ ok: false, error: "No encontrado" }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ ok: false, error: "Server error" });
});

// Start
app.listen(PORT, "0.0.0.0", () => {
  console.log("ApagaNet API ready on :" + PORT);
});

process.on("unhandledRejection", (e) => console.error("unhandledRejection:", e));
process.on("uncaughtException", (e) => console.error("uncaughtException:", e));
