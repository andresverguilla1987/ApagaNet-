import pg from "pg";
const { Pool } = pg;
const conn = process.env.DATABASE_URL || process.env.PGCONN || "";
export const pool = new Pool({ connectionString: conn });
