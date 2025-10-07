import { Router } from "express";
import { pool } from "../lib/db.js";
import crypto from "crypto";

const r = Router();

// POST /admin/homes  { user_id, name? }
r.post("/homes", async (req, res) => {
  const { user_id, name } = req.body || {};
  if (!user_id) return res.status(400).json({ ok:false, error:"user_id required" });
  try {
    const q = await pool.query(
      "insert into homes(user_id, name) values ($1, coalesce($2,'Home')) returning id, user_id, name, created_at",
      [user_id, name || null]
    );
    res.json({ ok:true, home: q.rows[0] });
  } catch (e) {
    res.status(500).json({ ok:false, error: String(e) });
  }
});

// POST /admin/agents  { home_id }
r.post("/agents", async (req, res) => {
  const { home_id } = req.body || {};
  if (!home_id) return res.status(400).json({ ok:false, error:"home_id required" });
  try {
    const h = await pool.query("select id from homes where id=$1", [home_id]);
    if (!h.rowCount) return res.status(404).json({ ok:false, error:"home not found" });

    const api_token = crypto.randomBytes(32).toString("hex");
    const q = await pool.query(
      "insert into agents(home_id, api_token) values ($1, $2) returning id, home_id, created_at",
      [home_id, api_token]
    );
    res.json({ ok:true, agent: q.rows[0], api_token });
  } catch (e) {
    res.status(500).json({ ok:false, error: String(e) });
  }
});

r.get("/homes", async (_req, res) => {
  try {
    const q = await pool.query("select id, user_id, name, created_at from homes order by created_at desc limit 50");
    res.json({ ok:true, homes: q.rows });
  } catch (e) {
    res.status(500).json({ ok:false, error:String(e) });
  }
});

r.get("/agents", async (_req, res) => {
  try {
    const q = await pool.query("select id, home_id, created_at from agents order by created_at desc limit 50");
    res.json({ ok:true, agents: q.rows });
  } catch (e) {
    res.status(500).json({ ok:false, error:String(e) });
  }
});

export default r;
