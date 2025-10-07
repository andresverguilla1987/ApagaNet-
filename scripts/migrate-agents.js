import fs from "fs";
import path from "path";
import url from "url";
import { Pool } from "pg";
import "dotenv/config";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const sqlPath = path.join(__dirname, "..", "src", "sql", "004_agents_min.sql");
const sql = fs.readFileSync(sqlPath, "utf-8");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  await pool.query(sql);
  console.log("✅ Applied 004_agents_min.sql");
} catch (e) {
  console.error("❌ Migration error", e);
  process.exit(1);
} finally {
  await pool.end();
}
