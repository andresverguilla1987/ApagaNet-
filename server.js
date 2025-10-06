// server.js — ApagaNet (PostgreSQL + JWT) — v0.2.2-pg-jwt
import "dotenv/config";
import express from "express";
import morgan from "morgan";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { pool } from "./src/lib/db.js";

import { requireAuth } from "./src/lib/authz.js";
import auth from "./src/routes/auth.js";
import devices from "./src/routes/devices.js";
import schedules from "./src/routes/schedules.js";

const app = express();
const PORT = Number(process.env.PORT) || 10000;

// Normaliza orígenes (coma separada, sin rutas)
const ORIGINS = (process.env.CORS_ORIGINS || "")
  .split(",").map(s => s.trim()).filter(Boolean);

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(helmet());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS: origin no permitido -> ${origin}`));
  }
}));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(compression());
app.use(rateLimit({ windowMs: 60_000, max: 200, standardHeaders: true, legacyHeaders: false }));
app.use(morgan("dev"));

// Salud
app.get("/", (_req, res) => res.send("ApagaNet API OK"));
app.get("/ping", async (_req, res) => {
  try {
    const r = await pool.query("select 1 as ok");
    res.json({
      ok: true,
      db: r.rows[0].ok === 1,
      app: process.env.APP_NAME || "ApagaNet",
      version: "0.2.2-pg-jwt",
      env: process.env.APP_ENV || "dev",
      port: PORT
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

app.get("/diag", async (_req, res) => {
  const dbOk = await pool.query("select 1 as ok").then(r => r.rows[0].ok === 1).catch(() => false);
  res.json({
    ok: true,
    db: dbOk,
    env: {
      APP_NAME: process.env.APP_NAME,
      APP_ENV: process.env.APP_ENV,
      PORT: process.env.PORT,
      CORS_ORIGINS: process.env.CORS_ORIGINS || ""
    },
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Rutas
app.use("/auth", auth);
app.use("/devices", requireAuth, devices);
app.use("/schedules", requireAuth, schedules);

// Cron protegido (Render Cron)
app.post("/tasks/run-scheduler", (req, res) => {
  if (req.headers.authorization !== `Bearer ${process.env.TASK_SECRET}`) {
    return res.sendStatus(401);
  }
  res.json({ ok: true, ranAt: new Date().toISOString() });
});

app.use((req, res) => {
  if (req.path === "/health" || req.path === "/hc") return res.sendStatus(200);
  return res.status(404).json({ ok: false, error: "Not Found" });
});

app.use((err, _req, res, _next) => {
  const msg = typeof err?.message === "string" ? err.message : String(err);
  console.error("ERROR:", err);
  res.status(500).json({ ok: false, error: msg });
});

process.on("unhandledRejection", e => console.error("unhandledRejection", e));
process.on("uncaughtException", e => console.error("uncaughtException", e));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`ApagaNet API (PostgreSQL + JWT) on :${PORT}`);
});
