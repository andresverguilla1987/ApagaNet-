import express from "express";
import { pool } from "../lib/db.js";
import crypto from "crypto";
const router = express.Router();

router.get("/homes", async (_req, res) => {
  const r = await pool.query("select * from homes order by created_at desc limit 20");
  res.json({ ok: true, homes: r.rows });
});

router.post("/homes", async (req, res) => {
  const { user_id, name = "Casa Demo" } = req.body || {};
  if (!user_id) return res.status(400).json({ ok: false, error: "user_id required" });
  const r = await pool.query("insert into homes(user_id, name) values($1,$2) returning *", [user_id, name]);
  res.json({ ok: true, home: r.rows[0] });
});

router.get("/agents", async (_req, res) => {
  const r = await pool.query("select id, home_id, created_at from agents order by created_at desc limit 20");
  res.json({ ok: true, agents: r.rows });
});

router.post("/agents", async (req, res) => {
  const { home_id } = req.body || {};
  if (!home_id) return res.status(400).json({ ok: false, error: "home_id required" });
  const api_token = crypto.randomBytes(32).toString("hex");
  const r = await pool.query("insert into agents(home_id, api_token) values($1,$2) returning id, home_id, api_token", [home_id, api_token]);
  res.json({ ok: true, agent: r.rows[0] });
});

export default router;
