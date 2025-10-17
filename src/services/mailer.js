// src/services/mailer.js (ESM)
import nodemailer from "nodemailer";
let transporter;
function ensureTransport() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false") === "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  return transporter;
}
export async function sendMail(to, subject, text) {
  const t = ensureTransport();
  const from = process.env.SMTP_FROM || "ApagaNet <no-reply@apaganet.local>";
  return t.sendMail({ from, to, subject, text });
}
export default { sendMail };
