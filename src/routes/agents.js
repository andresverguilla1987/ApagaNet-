import { Router } from "express";
import { pool } from "../lib/db.js";

const r = Router();

// Helper: map JS day (0=Sun) to 1..7 (Mon..Sun) used in schedules.days
function jsDayToPg(d) {
  // in schedules I assumed 1..7 = Mon..Sun
  return d === 0 ? 7 : d; // Sun -> 7
}

// GET /agents/next-actions?homeId=...
// Very simple policy: find schedules active at current time for devices owned by the user
// that is linked to the given home (homes.user_id). For each, emit a 'block' or 'unblock'.
r.get("/next-actions", async (req, res) => {
  const { homeId } = req.query;
  if (!homeId) return res.status(400).json({ ok:false, error:"homeId required" });

  // Current local (server) time and day
  const now = new Date();
  const hh = now.toISOString().substring(11,16); // HH:MM in UTC; fine for demo
  const dow = jsDayToPg(now.getUTCDay());

  try {
    // 1) resolve user via home
    const h = await pool.query("select id, user_id from homes where id = $1", [homeId]);
    if (!h.rowCount) return res.status(404).json({ ok:false, error:"home not found" });
    const userId = h.rows[0].user_id;

    // 2) fetch active schedules crossing current time and day
    // NOTE: times are compared as text HH:MM for demo simplicity; in prod use proper time operators
    const q = `
      select s.id as schedule_id,
             s.device_id, s.block_from, s.block_to, s.days, s.active,
             d.mac, d.name, d.blocked
        from schedules s
        join devices d on d.id = s.device_id
       where s.user_id = $1
         and s.active is true
         and ( $3 = any(s.days) )
         and to_char(s.block_from, 'HH24:MI') <= $2
         and to_char(s.block_to,   'HH24:MI') >  $2
    `;
    const r1 = await pool.query(q, [userId, hh, dow]);

    // 3) For each schedule, if device is not blocked → action block; otherwise none.
    const actions = [];
    for (const row of r1.rows) {
      if (!row.blocked) {
        actions.push({
          type: "block",
          target: { deviceId: row.device_id, mac: row.mac, name: row.name },
          params: { reason: "schedule", scheduleId: row.schedule_id }
        });
      }
    }

    return res.json({ ok:true, actions });
  } catch (e) {
    console.error("next-actions error", e);
    res.status(500).json({ ok:false, error:String(e) });
  }
});

// POST /agents/report  { homeId, results: [{action, result}] }
r.post("/report", async (req, res) => {
  const { homeId, results } = req.body || {};
  if (!homeId) return res.status(400).json({ ok:false, error:"homeId required" });
  if (!Array.isArray(results)) return res.status(400).json({ ok:false, error:"results[] required" });

  try {
    // Basic validation for home
    const h = await pool.query("select id from homes where id = $1", [homeId]);
    if (!h.rowCount) return res.status(404).json({ ok:false, error:"home not found" });

    await pool.query(
      "insert into agent_reports(home_id, payload) values ($1, $2)",
      [homeId, { results, reportedAt: new Date().toISOString() }]
    );

    return res.json({ ok:true });
  } catch (e) {
    console.error("report error", e);
    res.status(500).json({ ok:false, error:String(e) });
  }
});

export default r;
