// server.js (ESM) — ApagaNet API — Phase 3
import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import compression from "compression";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { pool } from "./src/lib/db.js";

// Routers existentes (mantén los que tengas)
import auth from "./src/routes/auth.js";
import devices from "./src/routes/devices.js";
import schedules from "./src/routes/schedules.js";
import agents from "./src/routes/agents.js";
import admin from "./src/routes/admin.js";
import alerts from "./src/routes/alerts.js";            // si falta POST /alerts, lo cubre el fallback
import mockRouter from "./src/routes/mockRouter.js";
import alertsSystem from "./src/routes/alerts-system.js";

// Notificaciones PRO (suscripciones + dispatch) - NUEVO
import subscriptionsRouter from "./src/routes/subscriptions.js";
import dispatchRouter from "./src/routes/dispatch.js";

// SMTP Phase 3 (admin por TASK_SECRET)
import emailRouterModule from "./src/routes/email.js";  // existente en tu árbol
const emailRouter = emailRouterModule?.default || emailRouterModule;

const app = express();
const PORT = Number(process.env.PORT) || 10000;
const VERSION = process.env.VERSION || "0.6.0";

// ========================== CORS ====================================
const ORIGINS = [
  ...((process.env.CORS_ORIGINS || "")
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean)),
  "http://localhost:3000",
  "http://localhost:5173",
].filter(Boolean);

app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
}));

const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    if (ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error("CORS_ORIGIN_NOT_ALLOWED"));
  },
  credentials: true,
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "x-apaganet-token",
    "x-task-secret",
    "x-admin-secret",
    "Idempotency-Key",
  ],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  maxAge: 86400,
};
app.use((_, res, next) => { res.setHeader("Vary", "Origin"); next(); });
app.use((req, res, next) => {
  cors(corsOptions)(req, res, (err) => {
    if (!err) return next();
    return res.status(403).json({ ok:false, error:"CORS: Origin not allowed", origin:req.headers.origin || null });
  });
});
app.options("*", cors(corsOptions));

// ================== Body / compresión / logs / rate =================
app.use(express.json({ limit: "1mb" }));
app.use((err, _req, res, next) => {
  if (err?.type === "entity.parse.failed") return res.status(400).json({ ok:false, error:"Invalid JSON" });
  return next(err);
});
app.use(compression());
app.use(morgan("dev"));
app.use(rateLimit({
  windowMs: 60_000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
}));

// ============================ Helpers ===============================
export function requireJWT(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ ok:false, error:"No token" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || "dev-secret");
    return next();
  } catch {
    return res.status(401).json({ ok:false, error:"Invalid token" });
  }
}

export function requireTaskSecret(req, res, next) {
  const expected = (process.env.TASK_SECRET || "").trim();
  if (!expected) return res.status(500).json({ ok:false, error:"TASK_SECRET no configurado" });
  const h = req.headers.authorization || "";
  const bearer = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  const headerAlt = (req.headers["x-task-secret"] || "").toString().trim();
  const provided = bearer || headerAlt;
  if (!provided) return res.status(401).json({ ok:false, error:"Falta credencial admin (Bearer o x-task-secret)" });
  if (provided !== expected) return res.status(401).json({ ok:false, error:"TASK_SECRET inválido" });
  return next();
}

async function dbPing() {
  const r = await pool.query("select 1 as ok");
  return { ok: r.rows?.[0]?.ok === 1 };
}

// ========================== Health/Ping =============================
app.head("/", (_req, res) => res.status(200).end());
app.get("/", (_req, res) => res.send("ApagaNet API OK"));
app.get("/ping", async (_req, res) => {
  try { const r = await dbPing(); res.json({ ok:true, db:r.ok, version:VERSION }); }
  catch (e) { res.status(500).json({ ok:false, error:String(e) }); }
});
app.get("/api/ping", (_req, res) => res.redirect(307, "/ping"));

app.get("/api/health", async (_req, res) => {
  let db=false; try { db = !!(await dbPing()).ok; } catch {}
  res.status(200).json({ ok:true, db, version:VERSION, time:new Date().toISOString() });
});
app.get("/api/diag", (_req, res) => {
  res.status(200).json({
    uptime: process.uptime(),
    pid: process.pid,
    memory: process.memoryUsage(),
    node: process.version,
    region: process.env.RENDER_REGION || null,
  });
});

// ========================= Rutas demo ===============================
app.get("/agents/modem-compat", async (req, res) => {
  const agent_id = String(req.query.agent_id || "");
  const report = { id: crypto.randomUUID(), agent_id, devices: [], created_at: new Date().toISOString() };
  try { await pool.query("insert into reports(id, agent_id, created_at) values ($1,$2, now())", [report.id, agent_id]); } catch {}
  res.json({ ok:true, report, fallback:false });
});

// =================== Rutas + aliases /api ===========================
app.use("/auth", auth);        app.use("/api/auth", auth);
app.use("/devices", requireJWT, devices);    app.use("/api/devices", requireJWT, devices);
app.use("/schedules", requireJWT, schedules);app.use("/api/schedules", requireJWT, schedules);
app.use("/agents", mockRouter); app.use("/agents", agents);
app.use("/api/agents", mockRouter); app.use("/api/agents", agents);

// Mint JWT (DEV)
app.get("/admin/jwt", requireTaskSecret, (req, res) => {
  const id = (req.query.id || "u1").toString();
  const email = (req.query.email || "demo@apaganet.test").toString();
  const token = jwt.sign({ id, email }, process.env.JWT_SECRET || "dev-secret", { expiresIn:"2h" });
  res.json({ ok:true, token, id, email });
});

// Admin + aliases
app.use("/admin", requireTaskSecret, admin);
app.use("/api/admin", requireTaskSecret, admin);

// Notificaciones PRO
app.use("/", (req, res, next)=> subscriptionsRouter({ requireTaskSecret, pool })(req, res, next));
app.use("/", (req, res, next)=> dispatchRouter({ requireTaskSecret, pool })(req, res, next));

// ALERTAS (JWT)
app.use("/v1", requireJWT, alerts);
app.use("/api/v1", requireJWT, alerts);

// ALERTAS de sistema (agentes/cron) con TASK_SECRET
app.use("/alerts", requireTaskSecret, alertsSystem);

// SMTP Phase 3: /api/email y /email
app.use((req, _res, next) => {
  if (!req.headers["x-admin-secret"]) {
    const bearer = (req.headers.authorization || "").startsWith("Bearer ")
      ? req.headers.authorization.slice(7).trim() : "";
    const task = (req.headers["x-task-secret"] || "").toString().trim();
    const provided = bearer || task;
    if (provided) req.headers["x-admin-secret"] = provided;
  }
  next();
});
if (emailRouter) {
  app.use("/api/email", emailRouter);
  app.use("/email", emailRouter);
  console.log("[email] Mounted at /api/email and /email");
}

// ========== 404 y errores ===========================================
app.use((req, res) => res.status(404).json({ ok:false, error:"No encontrado", path:req.originalUrl }));
app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ ok:false, error:"Server error" }); });

// ========== Start ====================================================
app.listen(PORT, "0.0.0.0", () => console.log("ApagaNet API ready on :"+PORT, "version:", VERSION));

process.on("unhandledRejection", (err) => console.error("[unhandledRejection]", err));
process.on("uncaughtException", (err) => console.error("[uncaughtException]", err));
