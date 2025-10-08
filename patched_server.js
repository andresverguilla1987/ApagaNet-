
import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import compression from "compression";
import jwt from "jsonwebtoken";
import { pool } from "./src/lib/db.js";

import auth from "./src/routes/auth.js";
import devices from "./src/routes/devices.js";
import schedules from "./src/routes/schedules.js";
import agents from "./src/routes/agents.js";
import admin from "./src/routes/admin.js";
import blocksRoutes from "./src/routes/blocks.js";

// ---------- Config ----------
const app = express();
const PORT = Number(process.env.PORT) || 10000;
const VERSION = process.env.VERSION || "0.6.0";

// CORS allow-list (coma o espacios). Agrega defaults útiles:
const ORIGINS = [
  ...((process.env.CORS_ORIGINS || "")
    .split(/[\s,]+/)
    .map(s => s.trim())
    .filter(Boolean)),
  "http://localhost:3000",
  "http://localhost:5173",
].filter(Boolean);

// Seguridad/proxy y middlewares base
app.set("trust proxy", 1);
app.disable("x-powered-by");

// Helmet: desactiva CORP para permitir assets desde orígenes permitidos si hace falta.
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

// CORS con allow-list real + preflight consistente
const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true); // curl / Postman
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

// JSON / compresión / logs / rate limit
app.use(express.json({ limit: "1mb" }));
app.use(compression());
app.use(morgan("dev"));
app.use(rateLimit({ windowMs: 60_000, max: 200, standardHeaders: true, legacyHeaders: false }));

// ---------- Utilidades ----------
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
  const t0 = performance.now?.() ?? Date.now();
  const r = await pool.query("select 1 as ok");
  const t1 = performance.now?.() ?? Date.now();
  const latencyMs = Math.round((t1 - t0) * 1000) / 1000; // si performance.now en ms, queda igual
  return { ok: r.rows?.[0]?.ok === 1, latencyMs };
}

// ---------- ADMIN / AGENT helpers (added) ----------
// Admin auth: re-use JWT and require user.role === 'admin'
function authenticateAdmin(req, res, next) {
  return requireJWT(req, res, () => {
    if (req.user && (req.user.role === "admin" || (process.env.ADMIN_IDS || "").split(",").includes(req.user.id))) {
      return next();
    }
    return res.status(403).json({ ok: false, error: "Forbidden - admin required" });
  });
}

// Agent auth: accept AGENT_TOKEN in Authorization Bearer or x-apaganet-token header.
// Also accept JWT tokens with role 'agent' if you use them.
function authenticateAgent(req, res, next) {
  const headerToken = (req.headers["x-apaganet-token"] || "").toString();
  const auth = (req.headers.authorization || "").toString();
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  const agentSecret = process.env.AGENT_TOKEN || "";
  if (agentSecret && (headerToken === agentSecret || bearer === agentSecret)) {
    req.agent = { id: req.headers["x-agent-id"] || req.body?.agent_id || null };
    return next();
  }
  try {
    if (bearer) {
      const payload = jwt.verify(bearer, process.env.JWT_SECRET || "dev-secret");
      if (payload && (payload.role === "agent" || payload.agent)) {
        req.agent = { id: payload.agent || payload.sub || null };
        return next();
      }
    }
  } catch (e) { /* ignore */ }
  return res.status(401).json({ ok: false, error: "Agent auth required" });
}

// publishToAgentQueue: DB-backed queue that agents poll.
// Agents must poll /agents/commands or similar to fetch commands.
async function publishToAgentQueue(payload) {
  try {
    await pool.query(
      `INSERT INTO agent_commands (agent_id, payload, delivered, created_at) VALUES ($1,$2,false,now())`,
      [payload.agent_id || null, JSON.stringify(payload)]
    );
  } catch (e) {
    console.error("publishToAgentQueue DB insert failed:", e);
    throw e;
  }
}

// ---------- Rutas públicas básicas ----------
app.head("/", (_req, res) => res.status(200).end());
app.get("/", (_req, res) => res.send("ApagaNet API OK"));

app.get("/ping", async (_req, res) => {
  try {
    const r = await dbPing();
    res.json({ ok: true, db: r.ok, dbLatencyMs: r.latencyMs, version: VERSION });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// Health (para monitores / Render)
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

// Diagnóstico compacto (idéntico a lo que probaste)
app.get("/api/diag", async (_req, res) => {
  try {
    const { ok: dbOk, latencyMs } = await dbPing();
    res.json({ ok: true, db: dbOk, dbLatencyMs: latencyMs, version: VERSION, time: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// ---------- Rutas de la app ----------
app.use("/auth", auth);
app.use("/devices", requireJWT, devices);
app.use("/schedules", requireJWT, schedules);
// agents endpoints use authenticateAgent where needed inside the routes; keep public mount
app.use("/agents", agents);
app.use("/admin", requireTaskSecret, admin);

// mount the new blocks/routes (uses pool, authenticateAgent/authenticateAdmin, publishToAgentQueue)
blocksRoutes(app, { db: pool, authenticateAgent, authenticateAdmin, publishToAgentQueue });

// Tarea protegida por token (scheduler)
app.post("/tasks/run-scheduler", requireTaskSecret, async (_req, res) => {
  await pool.query("insert into schedule_runs(ran_at,checked,set_blocked,set_unblocked) values (now(),0,0,0)");
  res.json({ ok: true, ranAt: new Date().toISOString() });
});

// ---------- 404 & errores ----------
app.use((_req, res) => res.status(404).json({ ok: false, error: "No encontrado" }));
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ ok: false, error: "Server error" });
});

// ---------- Arranque ----------
app.listen(PORT, "0.0.0.0", () => {
  console.log("ApagaNet API ready on :" + PORT);
});

// Opcional: captura errores no manejados para que no tumben el proceso
process.on("unhandledRejection", (e) => console.error("unhandledRejection:", e));
process.on("uncaughtException", (e) => console.error("uncaughtException:", e));
