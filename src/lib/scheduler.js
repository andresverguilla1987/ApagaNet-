// src/lib/scheduler.js — Evalúa horarios y marca dispositivos como bloqueados/desbloqueados
import { pool } from "./db.js";

function toMinutes(hhmm){
  const [h, m] = String(hhmm).split(":").map(n => parseInt(n, 10));
  return (h * 60) + (m || 0);
}

function inRange(nowMin, fromMin, toMin){
  if (Number.isNaN(fromMin) || Number.isNaN(toMin)) return false;
  if (fromMin === toMin) return false;
  if (fromMin < toMin){
    return nowMin >= fromMin && nowMin < toMin;
  } else {
    return nowMin >= fromMin || nowMin < toMin;
  }
}

function weekday1_7(date){
  const d = date.getDay(); // 0=Sun..6=Sat
  return d === 0 ? 7 : d;
}

export async function runScheduler({ now = new Date() } = {}){
  const q = await pool.query(`
    select s.id as schedule_id, s.user_id, s.device_id, s.block_from, s.block_to, s.days, s.active,
           d.id as d_id, d.blocked as d_blocked
    from schedules s
    join devices d on d.id = s.device_id
    where s.active = true
  `);

  const wday = weekday1_7(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const desired = new Map(); // device_id -> shouldBlock
  for (const r of q.rows){
    const days = Array.isArray(r.days) ? r.days : [];
    if (!days.includes(wday)) continue;
    const fromMin = toMinutes(r.block_from);
    const toMin   = toMinutes(r.block_to);
    const hit = inRange(nowMin, fromMin, toMin);
    if (hit){
      desired.set(r.device_id, true);
    } else {
      if (!desired.has(r.device_id)) desired.set(r.device_id, false);
    }
  }

  const ids = Array.from(new Set(q.rows.map(r => r.device_id)));
  const out = { ok:true, now: now.toISOString(), wday, nowMin, checked: ids.length, setBlocked: [], setUnblocked: [], unchanged: [] };

  for (const id of ids){
    const want = desired.get(id) === true;
    const curQ = await pool.query("select blocked from devices where id = $1", [id]);
    const cur = curQ.rows[0]?.blocked === true;
    if (cur === want){ out.unchanged.push(id); continue; }
    await pool.query("update devices set blocked = $1, updated_at = now() where id = $2", [want, id]);
    if (want) out.setBlocked.push(id); else out.setUnblocked.push(id);
  }

  await pool.query(
    `insert into schedule_runs(ran_at, checked, set_blocked, set_unblocked)
     values (now(), $1, $2, $3)`,
    [out.checked, out.setBlocked.length, out.setUnblocked.length]
  ).catch(()=>{});

  return out;
}
