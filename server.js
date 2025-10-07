// server.js — ApagaNet backend (con /agents)
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

const app = express();
const PORT = Number(process.env.PORT) || 10000;

// CORS_ORIGINS puede separarse por comas o espacios
const ORIGINS = (process.env.CORS_ORIGINS || "")
  .split(/[\s,]+/)
  .map(s => s.trim())
  .filter(Boolean);

app.set("trust proxy", 1);
app.use(helmet());
app.use(cors(ORIGINS.length ? { origin: ORIGINS } : {}));
app.use(express.json());
app.use(compression());
app.use(morgan("dev"));
app.use(rateLimit({ windowMs: 60_000, max: 200 }));

// ---------- Health ----------
app.get("/", (_req, res) => res.send("ApagaNet API OK"));
app.get("/ping", async (_req, res) => {
  try {
    const r = await pool.query("select 1 as ok");
    res.json({
      ok: true,
      db: r.rows[0]?.ok === 1,
      app: process.env.APP_NAME || "ApagaNet",
      version: "0.4.0-agents",
      env: process.env.APP_ENV || "prod",
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// ---------- Middlewares de auth ----------
export function requireJWT(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ ok: false, error: "No token" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || "dev-secret");
    next();
  } catch (_e) {
    return res.status(401).json({ ok: false, error: "Invalid token" });
  }
}

export async function requireAgent(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ ok: false, error: "No agent token" });
  try {
    const q = await pool.query(
      "select id, home_id from agents where api_token = $1 limit 1",
      [token]
    );
    if (!q.rowCount) return res.status(401).json({ ok: false, error: "Invalid agent token" });
    req.agent = { id: q.rows[0].id, home_id: q.rows[0].home_id };
    req.homeId = req.agent.home_id;
    next();
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
}

export function requireTaskSecret(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token || token !== (process.env.TASK_SECRET || "")) {
    return res.sendStatus(401);
  }
  next();
}

// ---------- Rutas ----------
app.use("/auth", auth);
app.use("/devices", requireJWT, devices);
app.use("/schedules", requireJWT, schedules);

// /agents protegido por token de agente
app.use("/agents", requireAgent, (req, _res, next) => {
  if (!req.query.homeId && req.homeId) req.query.homeId = req.homeId;
  if (req.body && !req.body.homeId && req.homeId) req.body.homeId = req.homeId;
  next();
}, agents);

// Cron protegido por TASK_SECRET
app.post("/tasks/run-scheduler", requireTaskSecret, async (_req, res) => {
  const checked = 0, set_blocked = 0, set_unblocked = 0;
  await pool.query(
    "insert into schedule_runs(ran_at,checked,set_blocked,set_unblocked) values (now(),$1,$2,$3)",
    [checked, set_blocked, set_unblocked]
  );
  res.json({ ok: true, ranAt: new Date().toISOString() });
});

// Debug opcional
app.get("/debug/devices", async (_req, res) => {
  try {
    const r = await pool.query(
      "select id,name,mac,blocked,updated_at from devices order by updated_at desc limit 50"
    );
    res.json({ ok: true, devices: r.rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

app.get("/debug/actions", async (_req, res) => {
  try {
    const r = await pool.query("select * from actions order by created_at desc limit 50");
    res.json({ ok: true, actions: r.rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

app.use((_req, res) => res.status(404).json({ ok: false, error: "Not found" }));

app.use((err, _req, res, _next) => {
  console.error("Unhandled error", err);
  res.status(500).json({ ok: false, error: "Server error" });
});

process.on("unhandledRejection", (e) => console.error("unhandledRejection", e));
process.on("uncaughtException", (e) => console.error("uncaughtException", e));

app.listen(PORT, "0.0.0.0", () => console.log("ApagaNet API ready on :" + PORT));
