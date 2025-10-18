// src/routes/dispatch.js — Phase 3
import { Router } from "express";

export default function dispatchRouter({ requireTaskSecret, pool }) {
  const r = Router();

  // Ensure alerts table (simple log of dispatches)
  async function ensure() {
    await pool.query(`
      create table if not exists alerts (
        id uuid primary key default gen_random_uuid(),
        level text not null default 'info',
        title text not null,
        message text,
        created_at timestamptz not null default now()
      );
    `).catch(()=>{});
  }
  ensure();

  r.post("/api/dispatch", requireTaskSecret, async (req, res) => {
    try {
      const { title = "Alerta", message = "", level = "info" } = req.body || {};

      // store alert row
      await pool.query("insert into alerts(title, message, level) values ($1,$2,$3)", [title, message, level]);

      // get subscribers
      const subs = (await pool.query("select * from subscriptions where active = true")).rows || [];

      const results = [];
      for (const s of subs) {
        if (s.channel === "email") {
          try {
            const mailerPkg = await import("../../email/mailer.js").catch(()=>null);
            const mailer = mailerPkg?.default || mailerPkg;
            if (mailer?.sendAlertEmail) {
              await mailer.sendAlertEmail(s.target, {
                title, level, deviceName: "Dispatch", timeISO: new Date().toISOString(), detailsUrl: ""
              });
              results.push({ target:s.target, status:"sent" });
            } else {
              results.push({ target:s.target, status:"noop" });
            }
          } catch (e) {
            results.push({ target:s.target, status:"error", error: e.message || String(e) });
          }
        } else if (s.channel === "webhook") {
          try {
            const resp = await fetch(s.target, {
              method: "POST",
              headers: { "content-type":"application/json" },
              body: JSON.stringify({ title, message, level, source:"ApagaNet" })
            });
            results.push({ target:s.target, status: resp.ok ? "sent" : "failed", code: resp.status });
          } catch (e) {
            results.push({ target:s.target, status:"error", error: e.message || String(e) });
          }
        }
      }

      res.status(201).json({ ok:true, delivered: results.length, results });
    } catch (e) {
      res.status(500).json({ ok:false, error:e.message || String(e) });
    }
  });

  return r;
}
