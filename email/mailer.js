// email/mailer.js — SMTP (Nodemailer) production-ready
// Supports SMTP_URL or discrete SMTP_* vars. Pooled transport for performance.
// Usage: sendAlertEmail(to, { title, level, deviceName, timeISO, detailsUrl })

import nodemailer from "nodemailer";

const SMTP_URL = process.env.SMTP_URL || "";
const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const SMTP_SECURE = (process.env.SMTP_SECURE || "").toLowerCase() === "true"; // true = port 465 TLS
const SMTP_FROM = process.env.SMTP_FROM || "ApagaNet <no-reply@apaganet.local>";
const SMTP_REPLY_TO = process.env.SMTP_REPLY_TO || "";

let transporter;

/** Build transporter once (pooled). */
function getTransport() {
  if (transporter) return transporter;
  if (SMTP_URL) {
    transporter = nodemailer.createTransport(SMTP_URL, {
      pool: true,
      maxConnections: Number(process.env.SMTP_POOL_MAX || 5),
      maxMessages: Number(process.env.SMTP_POOL_MSG || 100),
    });
  } else {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
      pool: true,
      maxConnections: Number(process.env.SMTP_POOL_MAX || 5),
      maxMessages: Number(process.env.SMTP_POOL_MSG || 100),
      tls: {
        // If your provider uses self-signed certs, set SMTP_TLS_REJECT_UNAUTH=false
        rejectUnauthorized: (process.env.SMTP_TLS_REJECT_UNAUTH || "true").toLowerCase() === "true",
      },
    });
  }
  return transporter;
}

function renderAlertHTML(payload) {
  const { title, level, deviceName, timeISO, detailsUrl } = payload;
  const leveColor = level === "critical" ? "#ef4444" : level === "warning" ? "#f59e0b" : "#22c55e";
  return `
  <div style="font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;padding:24px;background:#0b0f14;color:#e6edf3">
    <div style="max-width:680px;margin:0 auto;border:1px solid #1f2832;border-radius:12px;overflow:hidden;background:#0f141a">
      <div style="padding:16px 20px;border-bottom:1px solid #1f2832;">
        <strong style="font-size:16px">ApagaNet — Alerta</strong>
      </div>
      <div style="padding:20px">
        <div style="font-size:18px;margin:0 0 10px 0">${title}</div>
        <div style="margin:8px 0 14px 0">
          <span style="display:inline-block;padding:2px 8px;border-radius:999px;border:1px solid #334155;background:#111827;color:#e6edf3">
            Nivel: <strong style="color:${leveColor}">${level}</strong>
          </span>
        </div>
        <table style="border-collapse:collapse;width:100%;font-size:14px">
          <tr><td style="padding:6px 0;color:#9aa7b4">Dispositivo</td><td style="padding:6px 0">${deviceName || "-"}</td></tr>
          <tr><td style="padding:6px 0;color:#9aa7b4">Hora</td><td style="padding:6px 0"><code>${timeISO}</code></td></tr>
          ${detailsUrl ? `<tr><td style="padding:6px 0;color:#9aa7b4">Detalles</td><td style="padding:6px 0"><a style="color:#60a5fa" href="${detailsUrl}">${detailsUrl}</a></td></tr>` : ""}
        </table>
      </div>
      <div style="padding:14px 20px;border-top:1px solid #1f2832;color:#9aa7b4;font-size:12px">
        © ApagaNet — Notificación automática
      </div>
    </div>
  </div>`;
}

export async function sendAlertEmail(to, payload) {
  const transport = getTransport();
  const subject = `[ApagaNet] ${payload.level || "info"}: ${payload.title || "Alerta"}`;
  const html = renderAlertHTML(payload);
  const text = `ApagaNet — ${payload.title || "Alerta"}\n` +
    `Nivel: ${payload.level || "info"}\n` +
    `Dispositivo: ${payload.deviceName || "-"}\n` +
    `Hora: ${payload.timeISO}\n` +
    (payload.detailsUrl ? `Detalles: ${payload.detailsUrl}\n` : "");

  const mail = {
    from: SMTP_FROM,
    to,
    subject,
    text,
    html,
    replyTo: SMTP_REPLY_TO || undefined,
  };

  const info = await transport.sendMail(mail);
  // Log minimal metadata (avoid leaking secrets)
  console.log("[mailer] sent", { to, messageId: info.messageId });
  return info;
}

export default { sendAlertEmail };
