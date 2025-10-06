// src/routes/schedules.js — CRUD schedules (Postgres)
import express from "express";
import { pool } from "../lib/db.js";
const router = express.Router();

router.get("/", async (req, res) => {
  const userId = req.headers["x-user-id"];
  if (!userId) return res.status(401).json({ ok:false, error:"x-user-id requerido" });
  try {
    const r = await pool.query("select * from schedules where user_id=$1 order by created_at desc", [userId]);
    res.json({ ok:true, schedules: r.rows });
  } catch (e) {
    res.status(500).json({ ok:false, error:String(e) });
  }
});

router.post("/", async (req, res) => {
  const userId = req.headers["x-user-id"];
  const { deviceId, blockFrom, blockTo, days, active } = req.body || {};
  if (!userId) return res.status(401).json({ ok:false, error:"x-user-id requerido" });
  if (!deviceId || !blockFrom || !blockTo) return res.status(400).json({ ok:false, error:"faltan campos" });
  try {
    const r = await pool.query(
      `insert into schedules(user_id, device_id, block_from, block_to, days, active)
       values ($1,$2,$3,$4, coalesce($5, '{1,2,3,4,5,6,7}'), coalesce($6,true))
       returning *`,
      [userId, deviceId, blockFrom, blockTo, days || null, active]
    );
    res.json({ ok:true, schedule: r.rows[0] });
  } catch (e) {
    res.status(500).json({ ok:false, error:String(e) });
  }
});

router.patch("/:id", async (req, res) => {
  const userId = req.headers["x-user-id"];
  const { id } = req.params;
  const { blockFrom, blockTo, days, active } = req.body || {};
  if (!userId) return res.status(401).json({ ok:false, error:"x-user-id requerido" });
  try {
    const r = await pool.query(
      `update schedules set
         block_from = coalesce($1, block_from),
         block_to = coalesce($2, block_to),
         days = coalesce($3, days),
         active = coalesce($4, active)
       where id = $5 and user_id = $6
       returning *`,
      [blockFrom ?? null, blockTo ?? null, days ?? null, active, id, userId]
    );
    if (!r.rowCount) return res.status(404).json({ ok:false, error:"no encontrado" });
    res.json({ ok:true, schedule: r.rows[0] });
  } catch (e) {
    res.status(500).json({ ok:false, error:String(e) });
  }
});

router.delete("/:id", async (req, res) => {
  const userId = req.headers["x-user-id"];
  const { id } = req.params;
  if (!userId) return res.status(401).json({ ok:false, error:"x-user-id requerido" });
  try {
    const r = await pool.query("delete from schedules where id=$1 and user_id=$2", [id, userId]);
    res.json({ ok: r.rowCount > 0 });
  } catch (e) {
    res.status(500).json({ ok:false, error:String(e) });
  }
});

export default router;
