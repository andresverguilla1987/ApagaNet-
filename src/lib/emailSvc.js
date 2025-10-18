// src/lib/emailSvc.js
import nodemailer from "nodemailer";

async function makeTransport() {
  const host = process.env.SMTP_HOST || process.env.MAIL_HOST;
  const port = Number(process.env.SMTP_PORT || process.env.MAIL_PORT || 587);
  const user = process.env.SMTP_USER || process.env.MAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.MAIL_PASS || process.env.SMTP_PASSWORD;
  const secure = port === 465;

  if (!host || !user || !pass) {
    throw new Error("SMTP creds missing: set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS");
  }

  return nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
}

export async function sendPlain(to, subject, text) {
  const transport = await makeTransport();
  const from = process.env.MAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER;
  const info = await transport.sendMail({ from, to, subject, text });
  return info.messageId || "sent";
}

export default { sendPlain };
