const express = require('express');
const router = express.Router();
const db = require('../db');
const { authAny } = require('../middleware/auth');

// Helpers
function parseLimit(q) {
  const n = Number(q);
  if (!Number.isFinite(n)) return 50;
  return Math.max(1, Math.min(200, n));
}
function parseSince(q) {
  if (!q) return null;
  const d = new Date(q);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// Create
router.post('/', authAny, async (req, res) => {
  try {
    const { level = 'info', title, message = null, home_id = null, device_id = null, metadata = {} } = req.body || {};
    if (!title || !String(title).trim()) {
      return res.status(400).json({ error: 'title is required' });
    }
    if (!['info','warn','critical'].includes(level)) {
      return res.status(400).json({ error: 'invalid level' });
    }
    const user_id = req.auth?.user_id || null;
    const { rows } = await db.query(
      `INSERT INTO alerts (id, user_id, home_id, device_id, level, title, message, metadata)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7::jsonb)
       RETURNING *`,
      [user_id, home_id, device_id, level, title, message, JSON.stringify(metadata)]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('POST /alerts error', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// List
router.get('/', authAny, async (req, res) => {
  try {
    const { home_id, device_id, unread, since, limit } = req.query;
    const lim = parseLimit(limit);
    const sinceIso = parseSince(since);

    const params = [];
    const where = [];

    if (req.auth.mode === 'jwt') {
      // JWT users only see their alerts
      where.push(`user_id = $${params.length + 1}`);
      params.push(req.auth.user_id);
      if (home_id) {
        where.push(`home_id = $${params.length + 1}`);
        params.push(home_id);
      }
    } else {
      // TASK agents must scope by home_id or device_id to avoid full-table scans
      if (home_id) {
        where.push(`home_id = $${params.length + 1}`);
        params.push(home_id);
      }
      if (device_id) {
        where.push(`device_id = $${params.length + 1}`);
        params.push(device_id);
      }
    }

    if (unread === '1' || unread === 'true') {
      where.push(`read_at IS NULL`);
    }
    if (sinceIso) {
      where.push(`created_at >= $${params.length + 1}`);
      params.push(sinceIso);
    }

    const sql = `SELECT * FROM alerts ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                 ORDER BY created_at DESC
                 LIMIT ${lim}`;
    const { rows } = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('GET /alerts error', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Get by id
router.get('/:id', authAny, async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await db.query(`SELECT * FROM alerts WHERE id = $1`, [id]);
    const alert = rows[0];
    if (!alert) return res.status(404).json({ error: 'not_found' });
    if (req.auth.mode === 'jwt' && alert.user_id !== req.auth.user_id) {
      return res.status(403).json({ error: 'forbidden' });
    }
    res.json(alert);
  } catch (err) {
    console.error('GET /alerts/:id error', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Mark read/unread
router.patch('/:id/read', authAny, async (req, res) => {
  try {
    const { id } = req.params;
    const { read } = req.body || {};
    if (typeof read !== 'boolean') return res.status(400).json({ error: 'read boolean required' });

    // authZ: Fetch owner
    const { rows } = await db.query(`SELECT user_id FROM alerts WHERE id = $1`, [id]);
    const found = rows[0];
    if (!found) return res.status(404).json({ error: 'not_found' });
    if (req.auth.mode === 'jwt' && found.user_id !== req.auth.user_id) {
      return res.status(403).json({ error: 'forbidden' });
    }

    const { rows: upd } = await db.query(
      `UPDATE alerts SET read_at = ${read ? 'now()' : 'NULL'} WHERE id = $1 RETURNING *`,
      [id]
    );
    res.json(upd[0]);
  } catch (err) {
    console.error('PATCH /alerts/:id/read error', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Update
router.put('/:id', authAny, async (req, res) => {
  try {
    const { id } = req.params;
    const { level, title, message, metadata } = req.body || {};

    const current = await db.query(`SELECT * FROM alerts WHERE id = $1`, [id]);
    const row = current.rows[0];
    if (!row) return res.status(404).json({ error: 'not_found' });
    if (req.auth.mode === 'jwt' && row.user_id !== req.auth.user_id) {
      return res.status(403).json({ error: 'forbidden' });
    }
    const newLevel = level ?? row.level;
    if (!['info','warn','critical'].includes(newLevel)) {
      return res.status(400).json({ error: 'invalid level' });
    }
    const newTitle = (title ?? row.title);
    if (!newTitle || !String(newTitle).trim()) {
      return res.status(400).json({ error: 'title is required' });
    }
    const newMessage = message ?? row.message;
    const newMetadata = metadata !== undefined ? JSON.stringify(metadata) : JSON.stringify(row.metadata);

    const { rows: upd } = await db.query(
      `UPDATE alerts SET level=$2, title=$3, message=$4, metadata=$5::jsonb WHERE id=$1 RETURNING *`,
      [id, newLevel, newTitle, newMessage, newMetadata]
    );
    res.json(upd[0]);
  } catch (err) {
    console.error('PUT /alerts/:id error', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Delete
router.delete('/:id', authAny, async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await db.query(`SELECT user_id FROM alerts WHERE id=$1`, [id]);
    const row = rows[0];
    if (!row) return res.status(404).json({ error: 'not_found' });
    if (req.auth.mode === 'jwt' && row.user_id !== req.auth.user_id) {
      return res.status(403).json({ error: 'forbidden' });
    }
    await db.query(`DELETE FROM alerts WHERE id=$1`, [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /alerts/:id error', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
