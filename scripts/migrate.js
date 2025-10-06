// scripts/migrate.js — aplica todos los archivos SQL de src/migrations en orden
import fs from "fs";
import path from "path";
import url from "url";
import pg from "pg";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, "..", "src", "migrations");

const { Pool } = pg;
const cn = process.env.DATABASE_URL;
if (!cn) {
  console.error("❌ Falta DATABASE_URL en variables de entorno.");
  process.exit(1);
}

const pool = new Pool({ connectionString: cn, ssl: cn.includes("render.com") ? { rejectUnauthorized: false } : undefined });

async function run() {
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith(".sql"))
    .sort(); // 001_*.sql, 002_*.sql ...

  console.log("🔧 Aplicando migraciones:", files);

  for (const f of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, f), "utf8");
    console.log("➡️  Ejecutando", f);
    await pool.query(sql);
  }

  await pool.end();
  console.log("✅ Migraciones aplicadas");
}

run().catch(e => {
  console.error("💥 Error en migraciones:", e);
  process.exit(1);
});
