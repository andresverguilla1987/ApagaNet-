// src/routes/admin.js
import express from "express";
import { pool } from "../lib/db.js";

const router = express.Router();

/**
 * GET /admin/users
 * Lista usuarios (simple). Requiere Bearer <TASK_SECRET> (lo aplica server.js con requireTaskSecret).
 */
router.get("/users", async (_req, res) => {
  try {
    const r = await pool.query(
      "SELECT id, email, role, created_at FROM users ORDER BY created_at DESC LIMIT 200"
    );
    return res.json({ ok: true, users: r.rows });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "db error" });
  }
});

/**
 * POST /admin/users/promote
 * Body: { email: string, role: 'admin' | 'user' }
 * Cambia el rol del usuario.
 */
router.post("/users/promote", async (req, res) => {
  const { email, role } = req.body || {};
  if (!email || !role) {
    return res.status(400).json({ ok: false, error: "email y role requeridos" });
  }
  try {
    const q = `
      UPDATE users
         SET role = $2
       WHERE email = $1
   RETURNING id, email, role, created_at
    `;
    const r = await pool.query(q, [String(email), String(role)]);
    if (r.rowCount === 0) {
      return res.status(404).json({ ok: false, error: "usuario no encontrado" });
    }
    return res.json({ ok: true, user: r.rows[0] });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "db error" });
  }
});

export default router;
