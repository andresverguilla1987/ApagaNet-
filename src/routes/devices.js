// src/routes/devices.js — CRUD dispositivos (Postgres)
import express from "express";
import { pool } from "../lib/db.js";
const router = express.Router();

router.get("/", async (req, res) => {
  const userId = req.headers["x-user-id"];
  if (!userId) return res.status(401).json({ ok:false, error:"x-user-id requerido" });
  try {
    const r = await pool.query("select * from devices where user_id = $1 order by created_at desc", [userId]);
    res.json({ ok:true, devices: r.rows });
  } catch (e) {
    res.status(500).json({ ok:false, error:String(e) });
  }
});

router.post("/", async (req, res) => {
  const userId = req.headers["x-user-id"];
  const { name, mac, vendor } = req.body || {};
  if (!userId) return res.status(401).json({ ok:false, error:"x-user-id requerido" });
  if (!name || !mac) return res.status(400).json({ ok:false, error:"name y mac requeridos" });
  try {
    const r = await pool.query(
      "insert into devices(user_id, name, mac, vendor) values ($1,$2,upper($3),$4) returning *",
      [userId, name, mac, vendor || null]
    );
    res.json({ ok:true, device: r.rows[0] });
  } catch (e) {
    res.status(500).json({ ok:false, error:String(e) });
  }
});

router.patch("/:id", async (req, res) => {
  const userId = req.headers["x-user-id"];
  const { id } = req.params;
  const { name, mac, vendor } = req.body || {};
  if (!userId) return res.status(401).json({ ok:false, error:"x-user-id requerido" });
  try {
    const r = await pool.query(
      `update devices set
         name = coalesce($1, name),
         mac = coalesce(upper($2), mac),
         vendor = coalesce($3, vendor)
       where id = $4 and user_id = $5
       returning *`,
      [name || null, mac || null, vendor || null, id, userId]
    );
    if (!r.rowCount) return res.status(404).json({ ok:false, error:"no encontrado" });
    res.json({ ok:true, device: r.rows[0] });
  } catch (e) {
    res.status(500).json({ ok:false, error:String(e) });
  }
});

router.delete("/:id", async (req, res) => {
  const userId = req.headers["x-user-id"];
  const { id } = req.params;
  if (!userId) return res.status(401).json({ ok:false, error:"x-user-id requerido" });
  try {
    const r = await pool.query("delete from devices where id=$1 and user_id=$2", [id, userId]);
    res.json({ ok: r.rowCount > 0 });
  } catch (e) {
    res.status(500).json({ ok:false, error:String(e) });
  }
});

export default router;
