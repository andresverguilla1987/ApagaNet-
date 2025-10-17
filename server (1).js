// server.js (ESM) — ApagaNet API (drop-in actualizado)
// Monta /alerts (TASK_SECRET), /notifications/* y mantiene /v1 (JWT)

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

// Routers existentes
import auth from "./src/routes/auth.js";
import devices from "./src/routes/devices.js";
import schedules from "./src/routes/schedules.js";
import agents from "./src/routes/agents.js";
import admin from "./src/routes/admin.js";
import alerts from "./src/routes/alerts.js";      // /v1 (JWT)
import mockRouter from "./src/routes/mockRouter.js";

// NUEVO
import alertsSystem from "./src/routes/alerts-system.js";      // /alerts (TASK_SECRET)
import notificationsRouter from "./src/routes/notifications.js"; // suscripciones + dispatch

const app = express();
const PORT = Number(process.env.PORT) || 10000;
const VERSION = process.env.VERSION || "0.6.0";

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
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    if (ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error("CORS: Origin not allowed"));
  },
  credentials: true,
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "x-apaganet-token",
    "x-task-secret",
  ],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  maxAge: 86400,
};
app.use((req, res, next) => { res.setHeader("Vary", "Origin"); next(); });
app.use(cors(corsOptions));
app.use(express.json({ limit: "1mb" }));
app.use(compression());
app.use(morgan("dev"));
app.use(rateLimit({ windowMs: 60_000, max: 200, standardHeaders: true, legacyHeaders: false }));

// Helpers
function requireJWT(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ ok: false, error: "No token" });
  try { req.user = jwt.verify(token, process.env.JWT_SECRET || "dev-secret"); next(); }
  catch { return res.status(401).json({ ok: false, error: "Invalid token" }); }
}
function requireTaskSecret(req, res, next) {
  const expected = (process.env.TASK_SECRET || "").trim();
  if (!expected) return res.status(500).json({ ok: false, error: "TASK_SECRET no configurado" });
  const h = req.headers.authorization || "";
  const bearer = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  const headerAlt = (req.headers["x-task-secret"] || "").toString().trim();
  const provided = bearer || headerAlt;
  if (!provided) return res.status(401).json({ ok: false, error: "Falta credencial admin" });
  if (provided !== expected) return res.status(401).json({ ok: false, error: "TASK_SECRET inválido" });
  next();
}

async function dbPing() {
  const r = await pool.query("select 1 as ok");
  return { ok: r.rows?.[0]?.ok === 1 };
}

// Health
app.head("/", (_req, res) => res.status(200).end());
app.get("/", (_req, res) => res.send("ApagaNet API OK"));
app.get("/ping", async (_req, res) => {
  try { const r = await dbPing(); res.json({ ok: true, db: r.ok, version: VERSION }); }
  catch (e) { res.status(500).json({ ok: false, error: String(e) }); }
});
app.get("/api/ping", (_req, res) => res.redirect(307, "/ping"));

// Abiertas para UI de pruebas (como las tenías)
app.get("/agents/modem-compat", async (req, res) => {
  const agent_id = String(req.query.agent_id || "");
  const report = { id: crypto.randomUUID(), agent_id, devices: [], created_at: new Date().toISOString() };
  try { await pool.query("insert into reports(id, agent_id, created_at) values ($1,$2, now())", [ report.id, agent_id ]); } catch {}
  res.json({ ok: true, report, fallback: false });
});

// Rutas existentes + aliases
app.use("/auth", auth);
app.use("/api/auth", auth);

app.use("/devices", requireJWT, devices);
app.use("/api/devices", requireJWT, devices);

app.use("/schedules", requireJWT, schedules);
app.use("/api/schedules", requireJWT, schedules);

app.use("/agents", mockRouter);
app.use("/agents", agents);
app.use("/api/agents", mockRouter);
app.use("/api/agents", agents);

// Admin con TASK_SECRET (sin JWT)
app.use("/admin", requireTaskSecret, admin);
app.use("/api/admin", requireTaskSecret, admin);

// === NUEVO: Suscripciones + Dispatch (webhooks/email) ===
app.use("/", notificationsRouter); // POST /notifications/subscriptions, POST /admin/notifications/dispatch

// === ALERTAS protegidas con JWT (tus rutas /v1) ===
app.use("/v1", requireJWT, alerts);
app.use("/api/v1", requireJWT, alerts);

// === ALERTAS de sistema (agentes/cron) con TASK_SECRET ===
app.use("/alerts", requireTaskSecret, alertsSystem);

// 404 / errores
app.use((req, res) => res.status(404).json({ ok: false, error: "No encontrado", path: req.originalUrl }));
app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ ok: false, error: "Server error" }); });

app.listen(PORT, "0.0.0.0", () => console.log("ApagaNet API ready on :" + PORT));
