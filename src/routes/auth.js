// src/routes/auth.js  (ESM)
// Rutas de autenticación para ApagaNet
// - POST /auth/login  -> { ok, access_token, user }
// - GET  /auth/me     -> { ok, user }
import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../lib/db.js";

const router = express.Router();

function signJWT(payload) {
  const secret = process.env.JWT_SECRET || "dev-secret";
  // 12 horas de vigencia
  return jwt.sign(payload, secret, { expiresIn: "12h" });
}

// POST /auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ ok: false, error: "email y password requeridos" });
    }

    const q = await pool.query(
      "select id, email, password_hash, role from users where email=$1 limit 1",
      [String(email)]
    );
    if (q.rowCount === 0) {
      return res.status(401).json({ ok: false, error: "credenciales inválidas" });
    }

    const u = q.rows[0];
    const match = await bcrypt.compare(String(password), String(u.password_hash || ""));
    if (!match) {
      return res.status(401).json({ ok: false, error: "credenciales inválidas" });
    }

    const access_token = signJWT({ uid: u.id, email: u.email, role: u.role });
    return res.json({
      ok: true,
      access_token,
      user: { id: u.id, email: u.email, role: u.role },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "server error" });
  }
});

// GET /auth/me  (requiere Bearer <JWT>)
router.get("/me", async (req, res) => {
  try {
    const h = req.headers.authorization || "";
    const token = h.startsWith("Bearer ") ? h.slice(7) : null;
    if (!token) return res.status(401).json({ ok: false, error: "No token" });

    const secret = process.env.JWT_SECRET || "dev-secret";
    const payload = jwt.verify(token, secret);

    // Trae datos frescos (opcional)
    const q = await pool.query(
      "select id, email, role, created_at from users where id=$1 limit 1",
      [payload.uid]
    );

    const user =
      q.rows[0] || { id: payload.uid, email: payload.email, role: payload.role };
    return res.json({ ok: true, user });
  } catch (e) {
    console.error(e);
    return res.status(401).json({ ok: false, error: "Invalid token" });
  }
});

export default router;
