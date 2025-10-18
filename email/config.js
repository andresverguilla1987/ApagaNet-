/**
 * email/config.js
 * Creates a pooled Nodemailer transporter from env.
 */
const nodemailer = require('nodemailer');

function bool(v, def=false){ 
  if (v === undefined || v === null || v === '') return def; 
  return /^(1|true|yes|on)$/i.test(String(v));
}

function int(v, def){
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
}

function readDkim(){
  const domainName = process.env.DKIM_DOMAIN;
  const selector = process.env.DKIM_SELECTOR;
  const pk64 = process.env.DKIM_PRIVATE_KEY_BASE64;
  if (!domainName || !selector || !pk64) return undefined;
  try {
    const privateKey = Buffer.from(pk64, 'base64').toString('utf8');
    return { domainName, keySelector: selector, privateKey };
  } catch (e) {
    console.warn('[email] Invalid DKIM_PRIVATE_KEY_BASE64:', e.message);
    return undefined;
  }
}

function createTransporter(){
  const secure = bool(process.env.SMTP_SECURE, true);
  const pool = bool(process.env.SMTP_POOL, true);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: int(process.env.SMTP_PORT, secure ? 465 : 587),
    secure,
    pool,
    maxConnections: int(process.env.SMTP_POOL_MAX_CONNECTIONS, 3),
    maxMessages: int(process.env.SMTP_POOL_MAX_MESSAGES, 100),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    tls: {
      // If you hit self-signed or provider oddities in dev:
      rejectUnauthorized: true
    },
    dkim: readDkim()
  });

  const from = process.env.SMTP_FROM || 'ApagaNet <no-reply@apaganet.local>';
  const replyTo = process.env.SMTP_REPLY_TO || undefined;

  return { transporter, defaults: { from, replyTo } };
}

module.exports = { createTransporter };
