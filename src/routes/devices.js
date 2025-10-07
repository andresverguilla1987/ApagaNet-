import express from "express";
import { pool } from "../lib/db.js";
const router = express.Router();

router.get("/", async (_req, res) => {
  const r = await pool.query("select id, name, mac, blocked, updated_at from devices order by updated_at desc limit 50");
  res.json({ ok: true, devices: r.rows });
});

router.post("/", async (req, res) => {
  const { name, mac } = req.body || {};
  if (!name || !mac) return res.status(400).json({ ok: false, error: "name/mac required" });
  const r = await pool.query(
    "insert into devices(name, mac, blocked) values($1,$2,false) returning *",
    [name, mac]
  );
  res.json({ ok: true, device: r.rows[0] });
});

export default router;
