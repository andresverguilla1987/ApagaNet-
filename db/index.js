const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: process.env.PG_MAX ? Number(process.env.PG_MAX) : 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 20000,
  ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: false }
});

async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (duration > 200) {
    console.log('[db] slow query', { duration, text: text.slice(0, 80) + '...', rows: res.rowCount });
  }
  return res;
}

module.exports = { pool, query };
