// src/lib/emailQueue.js (ESM)
// Outbox + Dedupe + Worker with SKIP LOCKED
import crypto from 'node:crypto';
import { pool } from './db.js';

// CJS interop for ../email/mailer.js
import mailerPkg from '../../email/mailer.js';
const { sendAlertEmail, sendTest, verify } = mailerPkg;

export function hashKey(str) {
  return crypto.createHash('sha256').update(String(str), 'utf8').digest('hex');
}

export function makeDedupeKey({ to, template, alertId, payload }) {
  if (alertId) return hashKey(`${to}|${template}|${alertId}`);
  const norm = JSON.stringify(payload ?? {});
  return hashKey(`${to}|${template}|${norm}`);
}

/**
 * Encola sin duplicar (ON CONFLICT DO NOTHING)
 * @returns {Promise<{enqueued:boolean,id?:string,dedupeKey:string}>}
 */
export async function enqueueEmail({ to, subject, html, text, template, payload, dedupeKey }) {
  const key = dedupeKey || makeDedupeKey({ to, template, alertId: payload?.alert_id, payload });
  const q = `
    INSERT INTO email_outbox (to_address, subject, html, text, template, payload, dedupe_key)
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT (dedupe_key) DO NOTHING
    RETURNING id
  `;
  const vals = [to, subject, html || null, text || null, template || null, payload || null, key];
  const r = await pool.query(q, vals);
  return { enqueued: r.rowCount > 0, id: r.rows?.[0]?.id || null, dedupeKey: key };
}

/**
 * Procesa un batch de correos pendientes con bloqueo seguro
 * @param {number} limit 
 * @returns {Promise<number>} count processed (claimed)
 */
export async function processEmailBatch(limit = 10) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const pick = `
      SELECT id
      FROM email_outbox
      WHERE status = 'pending'
        AND (retry_at IS NULL OR retry_at <= now())
      ORDER BY created_at
      FOR UPDATE SKIP LOCKED
      LIMIT $1
    `;
    const { rows } = await client.query(pick, [limit]);
    await client.query('COMMIT');
    for (const row of rows) {
      await processOne(row.id);
    }
    return rows.length;
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    throw e;
  } finally {
    client.release();
  }
}

async function processOne(id) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE email_outbox
         SET status='sending', updated_at=now()
       WHERE id=$1 AND status='pending'
       RETURNING id, to_address, subject, html, text, template, payload, attempts`,
      [id]
    );
    if (rows.length === 0) { await client.query('COMMIT'); return; } // already taken

    const job = rows[0];
    let info;

    // Dispatch by template
    if (job.template === 'alert') {
      const payload = job.payload || {};
      info = await sendAlertEmail(job.to_address, payload);
    } else if (job.template === 'test') {
      info = await sendTest(job.to_address);
    } else {
      // Raw fallback
      const configMod = await import('../../email/config.js');
      const { createTransporter } = configMod.default?.createTransporter ? configMod.default : configMod;
      const { transporter, defaults } = createTransporter();
      info = await transporter.sendMail({
        from: defaults.from,
        to: job.to_address,
        subject: job.subject,
        text: job.text || undefined,
        html: job.html || undefined,
      });
    }

    await client.query(
      `UPDATE email_outbox
         SET status='sent', sent_at=now(), updated_at=now(), attempts=attempts+1, last_error=NULL
       WHERE id=$1`, [id]
    );
    await client.query('COMMIT');
    return info;
  } catch (e) {
    const attQ = await client.query('SELECT attempts FROM email_outbox WHERE id=$1', [id]);
    const n = (attQ.rows?.[0]?.attempts ?? 0) + 1;
    const delaySec = Math.min(900, Math.pow(2, Math.min(n, 8)) * 5); // 5s → 15m
    const retryAt = new Date(Date.now() + delaySec * 1000).toISOString();
    await client.query(
      `UPDATE email_outbox
         SET status='pending', attempts=$2, last_error=$3, retry_at=$4, updated_at=now()
       WHERE id=$1`,
      [id, n, e?.message || String(e), retryAt]
    );
    try { await client.query('COMMIT'); } catch {}
  } finally {
    client.release();
  }
}
