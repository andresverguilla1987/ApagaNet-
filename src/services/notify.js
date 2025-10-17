// src/services/notify.js (ESM)
import crypto from "node:crypto";
import fetch from "node-fetch";
import { pool } from "../lib/db.js";
import mailer from "./mailer.js";

function signBody(body, secret) {
  if (!secret) return null;
  const h = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return `sha256=${h}`;
}

export async function enqueueAlert(alert) {
  const params = [];
  const wh = ["active = true"];
  if (alert.user_id)  { wh.push(`(user_id IS NULL OR user_id = $${params.length+1})`); params.push(alert.user_id); }
  if (alert.home_id)  { wh.push(`(home_id IS NULL OR home_id = $${params.length+1})`); params.push(alert.home_id); }
  if (alert.device_id){ wh.push(`(device_id IS NULL OR device_id = $${params.length+1})`); params.push(alert.device_id); }
  const sql = `select * from alert_subscriptions where ${wh.join(" and ")}`;
  const { rows: subs } = await pool.query(sql, params);
  for (const s of subs) {
    const payload = { type: "alert.created", ts: new Date().toISOString(), data: alert };
    await pool.query(`insert into alert_outbox (id, subscription_id, payload) values (gen_random_uuid(), $1, $2::jsonb)`,
      [s.id, JSON.stringify(payload)]);
  }
  return { matched: subs.length };
}

export async function dispatchOutboxBatch(limit = 50) {
  const { rows: items } = await pool.query(
    `select o.*, s.type as sub_type, s.endpoint_url, s.email
     from alert_outbox o join alert_subscriptions s on s.id=o.subscription_id
     where o.status='pending' order by o.created_at asc limit $1`,
    [limit]
  );
  let sent = 0, failed = 0;
  for (const it of items) {
    try {
      if (it.sub_type === "webhook") {
        const body = JSON.stringify(it.payload);
        const headers = { "Content-Type": "application/json" };
        const sig = signBody(body, process.env.WEBHOOK_SECRET || "");
        if (sig) headers["X-ApagaNet-Signature"] = sig;
        const resp = await fetch(it.endpoint_url, { method: "POST", headers, body });
        if (!resp.ok) throw new Error(`webhook ${resp.status}`);
      } else if (it.sub_type === "email") {
        const alert = it.payload?.data || {};
        const subject = `[ApagaNet] ${String(alert.level || "").toUpperCase()}: ${alert.title}`;
        const text = `Nivel: ${alert.level}\nTitulo: ${alert.title}\nMensaje: ${alert.message || ""}\nFecha: ${alert.created_at}\n`;
        await mailer.sendMail(it.email, subject, text);
      } else {
        throw new Error("unknown subscription type");
      }
      await pool.query(`update alert_outbox set status='sent', attempts=attempts+1, last_error=null, sent_at=now() where id=$1`, [it.id]);
      sent++;
    } catch (e) {
      await pool.query(`update alert_outbox set status='pending', attempts=attempts+1, last_error=$2 where id=$1`, [it.id, (e?.message || String(e)).slice(0,240)]);
      failed++;
    }
  }
  return { total: items.length, sent, failed };
}

export default { enqueueAlert, dispatchOutboxBatch };
