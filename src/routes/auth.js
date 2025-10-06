// src/routes/auth.js — login/upsert usuario
import express from "express";
import { pool } from "../lib/db.js";
const router = express.Router();

router.post("/login", async (req, res) => {
  const { email, name } = req.body || {};
  if (!email) return res.status(400).json({ ok:false, error:"email requerido" });
  try {
    const upsert = await pool.query(
      `insert into users(email, name) values ($1, $2)
       on conflict (email) do update set name = coalesce(excluded.name, users.name)
       returning *`,
      [email, name || null]
    );
    res.json({ ok:true, user: upsert.rows[0] });
  } catch (e) {
    res.status(500).json({ ok:false, error: String(e) });
  }
});

export default router;
