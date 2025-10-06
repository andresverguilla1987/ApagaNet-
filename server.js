// server.js — ApagaNet backend (PostgreSQL)
import "dotenv/config";
import express from "express";
import morgan from "morgan";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { pool } from "./src/lib/db.js";

import auth from "./src/routes/auth.js";
import devices from "./src/routes/devices.js";
import schedules from "./src/routes/schedules.js";

const app = express();
const PORT = Number(process.env.PORT) || 10000;
const ORIGINS = (process.env.CORS_ORIGINS || "").split(",").filter(Boolean);

app.use(helmet());
app.use(cors(ORIGINS.length ? { origin: ORIGINS } : {}));
app.use(express.json());
app.use(morgan("dev"));
app.use(rateLimit({ windowMs: 60_000, max: 200 }));

app.get("/", (_req, res) => res.send("ApagaNet API OK"));
app.get("/ping", async (_req, res) => {
  try {
    const r = await pool.query("select 1 as ok");
    res.json({ ok: true, db: r.rows[0].ok === 1, app: process.env.APP_NAME || "ApagaNet", version: "0.2.0-postgres", env: process.env.APP_ENV || "dev", port: PORT });
  } catch (e) {
    res.status(500).json({ ok:false, error: String(e) });
  }
});

app.get("/diag", async (_req, res) => {
  const dbOk = await pool.query("select 1 as ok").then(r=>r.rows[0].ok===1).catch(()=>false);
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

app.use("/auth", auth);
app.use("/devices", devices);
app.use("/schedules", schedules);

// Tarea programada (cron) — usar con Render Cron
app.post("/tasks/run-scheduler", (req, res) => {
  if (req.headers.authorization !== `Bearer ${process.env.TASK_SECRET}`) return res.sendStatus(401);
  // Aquí luego: lógica de revisar horarios y disparar bloqueos
  res.json({ ok: true, ranAt: new Date().toISOString() });
});

process.on("unhandledRejection", (e) => console.error("unhandledRejection", e));
process.on("uncaughtException", (e) => console.error("uncaughtException", e));

app.listen(PORT, "0.0.0.0", () => console.log(`ApagaNet API (PostgreSQL) on :${PORT}`));
