// src/routes/alerts.js
// Rutas de Alertas (geocercas / eventos) para ApagaNet
// ESM module
import express from "express";
import crypto from "node:crypto";
import fetch from "node-fetch"; // si tu runtime ya provee fetch global, puedes borrar esta línea
import nodemailer from "nodemailer";
import { pool } from "../lib/db.js";

const router = express.Router();

// --- Utils ---
const id = () => crypto.randomUUID();

function validateRule(r) {
  const errors = [];
  if (!r || typeof r !== "object") {
    errors.push("rule must be object");
    return errors;
  }
  if (!r.name) errors.push("name is required");
  const on = r.on ?? r.on_event ?? "both";
  if (!["enter", "exit", "both"].includes(on)) errors.push("on must be enter|exit|both");
  const channel = r.channel ?? "email";
  if (!["email", "webhook"].includes(channel)) errors.push("channel must be email|webhook");

  if (channel === "email" && !r.emailTo && !r.email_to) {
    errors.push("emailTo is required for email channel");
  }
  if (channel === "webhook" && !r.webhook_url) {
    errors.push("webhook_url is required for webhook channel");
  }
  const fenceIds = r.fenceIds ?? r.fence_ids ?? [];
  if (!Array.isArray(fenceIds)) errors.push("fenceIds must be array");

  return errors;
}

async function getTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = String(process.env.SMTP_SECURE || "false") === "true";
  if (!host || !user || !pass) {
    throw new Error("SMTP env vars missing (SMTP_HOST, SMTP_USER, SMTP_PASS)");
  }
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
  return transporter;
}

async function sendEmail({ to, subject, text, html }) {
  const transporter = await getTransport();
  const from = process.env.MAIL_FROM || "ApagaNet <no-reply@apaganet>";
  await transporter.sendMail({ from, to, subject, text, html });
}

async function sendWebhook({ url, secret, payload }) {
  const body = JSON.stringify(payload ?? {});
  const headers = { "content-type": "application/json" };
  if (secret) {
    const signature = crypto.createHmac("sha256", String(secret)).update(body).digest("hex");
    headers["x-apaganet-signature"] = signature;
  }
  const res = await fetch(url, { method: "POST", headers, body });
  const txt = await res.text();
  return { status: res.status, body: txt };
}

// --- GET reglas por device ---
router.get("/v1/parents/device/:deviceId/alerts", async (req, res) => {
  try {
    const deviceId = String(req.params.deviceId || "");
    const r = await pool.query(
      "select id, device_id, name, on_event as on, channel, email_to as emailTo, webhook_url, webhook_secret, fence_ids as "fenceIds", active, created_at from alert_rules where device_id=$1 order by created_at desc",
      [deviceId]
    );
    return res.json({ ok: true, rules: r.rows });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "db error" });
  }
});

// --- POST reemplaza todas las reglas del device ---
router.post("/v1/parents/device/:deviceId/alerts", async (req, res) => {
  const client = await pool.connect();
  try {
    const deviceId = String(req.params.deviceId || "");
    const rules = Array.isArray(req.body?.rules) ? req.body.rules : [];

    for (const r of rules) {
      const errs = validateRule(r);
      if (errs.length) {
        return res.status(400).json({ ok: false, error: "invalid rule", details: errs, rule: r });
      }
    }

    await client.query("begin");
    await client.query("delete from alert_rules where device_id=$1", [deviceId]);

    for (const raw of rules) {
      const rule = {
        id: raw.id || id(),
        deviceId,
        name: raw.name,
        on: raw.on ?? raw.on_event ?? "both",
        channel: raw.channel ?? "email",
        emailTo: raw.emailTo ?? raw.email_to ?? null,
        webhook_url: raw.webhook_url ?? null,
        webhook_secret: raw.webhook_secret ?? null,
        fenceIds: raw.fenceIds ?? raw.fence_ids ?? [],
        active: typeof raw.active === "boolean" ? raw.active : true,
      };

      await client.query(
        `insert into alert_rules 
         (id, device_id, name, on_event, channel, email_to, webhook_url, webhook_secret, fence_ids, active, created_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now())`,
        [
          rule.id,
          rule.deviceId,
          rule.name,
          rule.on,
          rule.channel,
          rule.emailTo,
          rule.webhook_url,
          rule.webhook_secret,
          JSON.stringify(rule.fenceIds),
          rule.active,
        ]
      );
    }

    await client.query("commit");
    return res.json({ ok: true, saved: rules.length });
  } catch (e) {
    try { await client.query("rollback"); } catch {}
    console.error(e);
    return res.status(500).json({ ok: false, error: "db error" });
  } finally {
    client.release();
  }
});

// --- POST dispatch de prueba (email o webhook) ---
router.post("/v1/parents/device/:deviceId/alerts/test-dispatch", async (req, res) => {
  try {
    const { channel, to, subject, payload, webhook_url, secret } = req.body || {};
    if (channel === "email") {
      if (!to) return res.status(400).json({ ok: false, error: "to required" });
      const subj = subject || "ApagaNet – Prueba de alerta";
      const text = JSON.stringify(payload ?? { hello: "world" }, null, 2);
      await sendEmail({ to, subject: subj, text });
      return res.json({ ok: true, sent: "email" });
    }
    if (channel === "webhook") {
      if (!webhook_url) return res.status(400).json({ ok: false, error: "webhook_url required" });
      const r = await sendWebhook({ url: webhook_url, secret, payload });
      return res.json({ ok: true, sent: "webhook", status: r.status, body: r.body });
    }
    return res.status(400).json({ ok: false, error: "channel must be email|webhook" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "send error" });
  }
});

export default router;
