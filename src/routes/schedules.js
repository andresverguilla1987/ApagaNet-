import express from "express";
import { pool } from "../lib/db.js";
const router = express.Router();

router.get("/", async (_req, res) => {
  const r = await pool.query("select * from schedules order by created_at desc limit 50");
  res.json({ ok: true, schedules: r.rows });
});

export default router;
