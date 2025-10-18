// src/routes/subscriptions.js — Phase 3
import { Router } from "express";

export default function subscriptionsRouter({ requireTaskSecret, pool }) {
  const r = Router();

  // Asegura tablas si no existen
  async function ensure() {
    await pool.query(`
      create table if not exists subscriptions (
        id uuid primary key default gen_random_uuid(),
        channel text not null check (channel in ('email','webhook')),
        target text not null,
        active boolean not null default true,
        created_at timestamptz not null default now()
      );
    `).catch(()=>{});
  }
  ensure();

  r.post("/api/subscriptions", requireTaskSecret, async (req, res) => {
    try {
      const { channel, target } = req.body || {};
      if (!channel || !target) return res.status(400).json({ ok:false, error:"channel/target requeridos" });
      const q = await pool.query(
        "insert into subscriptions(channel, target) values ($1,$2) returning *",
        [channel, target]
      );
      res.status(201).json({ ok:true, subscription:q.rows[0] });
    } catch (e) {
      res.status(500).json({ ok:false, error:e.message || String(e) });
    }
  });

  r.get("/api/subscriptions", requireTaskSecret, async (_req, res) => {
    try {
      const q = await pool.query("select * from subscriptions order by created_at desc limit 200");
      res.json({ ok:true, subscriptions:q.rows });
    } catch (e) {
      res.status(500).json({ ok:false, error:e.message || String(e) });
    }
  });

  r.delete("/api/subscriptions/:id", requireTaskSecret, async (req, res) => {
    try {
      const id = req.params.id;
      const q = await pool.query("delete from subscriptions where id = $1", [id]);
      res.json({ ok:true, deleted:q.rowCount });
    } catch (e) {
      res.status(500).json({ ok:false, error:e.message || String(e) });
    }
  });

  return r;
}
