// scripts/migrate.js — applies all SQL files in src/migrations
import fs from "fs";
import path from "path";
import url from "url";
import pg from "pg";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, "..", "src", "migrations");

const { Pool } = pg;
const cn = process.env.DATABASE_URL;
if (!cn) { console.error("❌ Missing DATABASE_URL"); process.exit(1); }

const pool = new Pool({
  connectionString: cn,
  ssl: cn.includes("render.com") ? { rejectUnauthorized: false } : undefined
});

async function run() {
  const files = fs.readdirSync(MIGRATIONS_DIR).filter(f=>f.endsWith(".sql")).sort();
  console.log("🔧 Applying migrations:", files);
  for (const f of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, f), "utf8");
    console.log("➡️  Running", f);
    await pool.query(sql);
  }
  await pool.end();
  console.log("✅ Done");
}

run().catch(e=>{ console.error("💥 Migration error:", e); process.exit(1); });
