// src/routes/admin.js
import express from "express";
import { pool } from "../lib/db.js";
import fetch from "node-fetch"; // usar fetch ESM (Node 20 también lo expone global, pero esto asegura compatibilidad)

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

/**
 * POST /admin/notifications/dispatch
 * Envía cada ALERTA reciente a todas las suscripciones tipo 'webhook' del mismo home_id.
 * Pensado para validar fin-a-fin (webhook.site) sin depender de una outbox.
 *
 * Opcional Body:
 *   - home_id?: string  -> si viene, filtra por ese home_id
 *   - minutes?: number  -> ventana de tiempo (por defecto 10 minutos)
 *   - limit?: number    -> máximo de alertas a considerar (por defecto 20)
 */
router.post("/notifications/dispatch", async (req, res) => {
  const { home_id, minutes = 10, limit = 20 } = req.body || {};
  try {
    // 1) Traer alertas recientes (con opción de filtrar por home_id)
    const params = [Number(minutes) || 10, Number(limit) || 20];
    let where = "created_at > now() - ($1::int || ' minutes')::interval";
    if (home_id) {
      where += " AND home_id = $3";
      params.push(String(home_id));
    }

    const { rows: alerts } = await pool.query(
      `SELECT * FROM alerts WHERE ${where} ORDER BY created_at DESC LIMIT $2`,
      params
    );

    const results = [];

    for (const a of alerts) {
      // 2) Obtener suscripciones webhook del mismo home_id
      const { rows: subs } = await pool.query(
        `
        SELECT id, endpoint_url
        FROM alert_subscriptions
        WHERE type = 'webhook' AND home_id = $1
        `,
        [a.home_id]
      );

      for (const s of subs) {
        try {
          const resp = await fetch(s.endpoint_url, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ type: "alert", alert: a }),
          });
          results.push({
            alert_id: a.id,
            sub_id: s.id,
            status: resp.status,
          });
        } catch (err) {
          results.push({
            alert_id: a.id,
            sub_id: s.id,
            error: String(err),
          });
        }
      }
    }

    return res.json({ ok: true, count_alerts: alerts.length, sent: results });
  } catch (e) {
    console.error("dispatch error:", e);
    return res.status(500).json({ ok: false, error: "server error" });
  }
});

export default router;
