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
// MOCK para pruebas de UI (equipos simulados)
import mockRouter from "./src/routes/mockRouter.js";

// --- App base ---
const app = express();
const PORT = Number(process.env.PORT) || 10000;
const VERSION = process.env.VERSION || "0.6.0";

// CORS
const ORIGINS = [
  ...((process.env.CORS_ORIGINS || "")
    .split(/[\s,]+/)
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
//  NUEVO: Comandos para el agente (mock en memoria)
// =====================================================
const commandQueue = new Map(); // agent_id -> Array<cmd>

app.get("/agents/commands", (req, res) => {
  const agentId = String(req.query.agent_id || "");
  const list = commandQueue.get(agentId) || [];
  commandQueue.set(agentId, []);
  return res.json(list);
});

app.post("/agents/commands", (req, res) => {
  const { agent_id, type, device_id, minutes } = req.body || {};
  if (!agent_id || !type) {
    return res.status(400).json({ ok: false, error: "agent_id y type son requeridos" });
  }
  const cmd = { type, device_id, minutes: minutes ? Number(minutes) : undefined, created_at: new Date().toISOString() };
  const list = commandQueue.get(String(agent_id)) || [];
  list.push(cmd);
  commandQueue.set(String(agent_id), list);
  return res.json({ ok: true, queued: cmd, totalPending: list.length });
});

// =====================================================
//  Rutas existentes (se mantienen)
// =====================================================
app.use("/auth", auth);
app.use("/devices", requireJWT, devices);
app.use("/schedules", requireJWT, schedules);
app.use("/agents", mockRouter);
app.use("/agents", agents);
app.use("/admin", requireTaskSecret, admin);

// =================== NUEVOS ENDPOINTS (MVP tracking) ===================

// 1) Reporte de ubicación (agente)
app.post("/v1/agents/report-location", async (req, res) => {
  const { device_id, lat, lon, acc, ts } = req.body || {};
  if (!device_id || lat == null || lon == null) {
    return res.status(400).json({ ok: false, error: "device_id, lat, lon son requeridos" });
  }
  try {
    await pool.query(
      "insert into locations(device_id, lat, lon, accuracy, ts) values ($1,$2,$3,$4, COALESCE(to_timestamp($5/1000.0), now()))",
      [String(device_id), Number(lat), Number(lon), acc != null ? Number(acc) : null, ts || null]
    );
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "db error" });
  }
});

// 2) Última ubicación (padre)
app.get("/v1/parents/device/:id/location/latest", requireJWT, async (req, res) => {
  const deviceId = String(req.params.id || "");
  try {
    const r = await pool.query(
      "select lat, lon, accuracy, extract(epoch from ts)*1000 as ts from locations where device_id=$1 order by ts desc limit 1",
      [deviceId]
    );
    return res.json({ ok: true, data: r.rows[0] || null });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "db error" });
  }
});

// 3) Inicio de viaje
app.post("/v1/agents/report-trip/start", async (req, res) => {
  const { device_id, start_ts, start_lat, start_lon } = req.body || {};
  if (!device_id) return res.status(400).json({ ok: false, error: "device_id requerido" });
  try {
    const r = await pool.query(
      "insert into trips(device_id, start_ts, start_lat, start_lon) values ($1, COALESCE(to_timestamp($2/1000.0), now()), $3, $4) returning id",
      [String(device_id), start_ts || null, start_lat || null, start_lon || null]
    );
    return res.json({ ok: true, tripId: r.rows[0].id });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "db error" });
  }
});

// 4) Puntos de viaje (batch)
app.post("/v1/agents/report-trip/points", async (req, res) => {
  const { trip_id, points } = req.body || {};
  if (!trip_id || !Array.isArray(points) || points.length === 0) {
    return res.status(400).json({ ok: false, error: "trip_id y points[]" });
  }
  try {
    const params = [];
    const values = points.map((p, idx) => {
      params.push(trip_id, p.lat, p.lon, p.acc ?? null, p.ts ?? null);
      const base = idx * 5;
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, COALESCE(to_timestamp($${base + 5}/1000.0), now()))`;
    });
    await pool.query(
      `insert into trip_points(trip_id, lat, lon, accuracy, ts) values ${values.join(",")}`,
      params
    );
    return res.json({ ok: true, inserted: points.length });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "db error" });
  }
});

// 5) Fin de viaje
app.post("/v1/agents/report-trip/end", async (req, res) => {
  const { trip_id, end_ts, end_lat, end_lon } = req.body || {};
  if (!trip_id) return res.status(400).json({ ok: false, error: "trip_id requerido" });
  try {
    await pool.query(
      "update trips set end_ts = COALESCE(to_timestamp($2/1000.0), now()), end_lat=$3, end_lon=$4 where id=$1",
      [trip_id, end_ts || null, end_lat || null, end_lon || null]
    );
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "db error" });
  }
});

// 6) Listar trips (padre)
app.get("/v1/parents/device/:id/trips", requireJWT, async (req, res) => {
  const deviceId = String(req.params.id || "");
  const { from, to, limit } = req.query;
  try {
    const r = await pool.query(
      `
      SELECT id,
             extract(epoch from start_ts)*1000 as start_ts,
             extract(epoch from end_ts)*1000   as end_ts,
             start_lat, start_lon, end_lat, end_lon
      FROM trips
      WHERE device_id=$1
        AND ($2::timestamptz IS NULL OR start_ts >= $2)
        AND ($3::timestamptz IS NULL OR start_ts <  $3)
      ORDER BY id DESC
      LIMIT ${Number(limit) || 50}
      `,
      [
        deviceId,
        from ? new Date(Number(from)) : null,
        to ? new Date(Number(to)) : null,
      ]
    );
    return res.json({ ok: true, trips: r.rows });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "db error" });
  }
});

// 7) Tamper report
app.post("/v1/agents/report-tamper", async (req, res) => {
  const { device_id, reason, details, ts } = req.body || {};
  if (!device_id || !reason) return res.status(400).json({ ok: false, error: "device_id y reason" });
  try {
    await pool.query(
      "insert into tamper_reports(device_id, reason, details, ts) values ($1,$2,$3, COALESCE(to_timestamp($4/1000.0), now()))",
      [String(device_id), String(reason), details ? JSON.stringify(details) : null, ts || null]
    );
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "db error" });
  }
});

// 8) Reglas de apps (padre: sobreescribe)
app.post("/v1/parents/device/:id/app-rules", requireJWT, async (req, res) => {
  const deviceId = String(req.params.id || "");
  const { blockedPackages = [], schedules = [] } = req.body || {};
  try {
    await pool.query("delete from app_rules where device_id=$1", [deviceId]);
    for (const pkg of blockedPackages) {
      await pool.query(
        "insert into app_rules(device_id, package_name, blocked) values ($1,$2,true)",
        [deviceId, String(pkg)]
      );
    }
    for (const s of schedules) {
      await pool.query(
        "insert into app_rules(device_id, package_name, blocked, start_minute, end_minute, days_mask) values ($1,$2,false,$3,$4,$5)",
        [deviceId, String(s.package_name), Number(s.start_minute), Number(s.end_minute), Number(s.days_mask ?? 127)]
      );
    }
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "db error" });
  }
});

// 9) Reglas de apps (agente)
app.get("/v1/agents/device/:id/app-rules", async (req, res) => {
  const deviceId = String(req.params.id || "");
  try {
    const r = await pool.query(
      "select package_name, blocked, start_minute, end_minute, days_mask from app_rules where device_id=$1",
      [deviceId]
    );
    return res.json({ ok: true, rules: r.rows });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "db error" });
  }
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
