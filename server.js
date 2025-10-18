// server.js (ESM) — ApagaNet API (drop-in actualizado + SMTP Phase 3 + JWT minter)
// Monta /alerts (TASK_SECRET), /notifications/*, mantiene /v1 (JWT) y añade /api/email y /email

import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import compression from "compression";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs"; // ya lo usas en otras rutas
import crypto from "node:crypto";
import { pool } from "./src/lib/db.js";

// Routers existentes
import auth from "./src/routes/auth.js";
import devices from "./src/routes/devices.js";
import schedules from "./src/routes/schedules.js";
import agents from "./src/routes/agents.js";
import admin from "./src/routes/admin.js";
import alerts from "./src/routes/alerts.js"; // /v1 (JWT)
import mockRouter from "./src/routes/mockRouter.js";

// NUEVO (notificaciones + alerts de sistema)
import alertsSystem from "./src/routes/alerts-system.js"; // /alerts (TASK_SECRET)
import notificationsRouter from "./src/routes/notifications.js"; // /notifications/* y /admin/notifications/dispatch

// NUEVO (SMTP Phase 3)
import emailRouter from "./routes/email.js"; // CJS -> default import OK en ESM

// --- App base ---
const app = express();
const PORT = Number(process.env.PORT) || 10000;
const VERSION = process.env.VERSION || "0.6.0";

// CORS
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
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true); // Postman/cURL
    if (ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error("CORS: Origin not allowed"));
  },
  credentials: true,
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "x-apaganet-token",
    "x-task-secret",
    "x-admin-secret", // router email
    "Idempotency-Key", // por si lo usas
  ],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  maxAge: 86400,
};
app.use((req, res, next) => {
  res.setHeader("Vary", "Origin");
  next();
});
app.use(cors(corsOptions));

app.use(express.json({ limit: "1mb" }));
app.use(compression());
app.use(morgan("dev"));
app.use(
  rateLimit({
    windowMs: 60_000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

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

/** Admin con TASK_SECRET:
 * Acepta:
 *  - Authorization: Bearer <TASK_SECRET>
 *  - o header: x-task-secret: <TASK_SECRET>
 */
function requireTaskSecret(req, res, next) {
  const expected = (process.env.TASK_SECRET || "").trim();
  if (!expected) {
    return res
      .status(500)
      .json({ ok: false, error: "TASK_SECRET no configurado" });
  }
  const h = req.headers.authorization || "";
  const bearer = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  const headerAlt = (req.headers["x-task-secret"] || "").toString().trim();
  const provided = bearer || headerAlt;
  if (!provided) {
    return res
      .status(401)
      .json({ ok: false, error: "Falta credencial admin (Bearer o x-task-secret)" });
  }
  if (provided !== expected) {
    return res.status(401).json({ ok: false, error: "TASK_SECRET inválido" });
  }
  next();
}

async function dbPing() {
  const r = await pool.query("select 1 as ok");
  return { ok: r.rows?.[0]?.ok === 1 };
}

// --- Raíz / Health ---
app.head("/", (_req, res) => res.status(200).end());
app.get("/", (_req, res) => res.send("ApagaNet API OK"));
app.get("/ping", async (_req, res) => {
  try
