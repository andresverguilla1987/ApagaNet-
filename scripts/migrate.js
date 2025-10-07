import "dotenv/config";
import fs from "fs";
import path from "path";
import url from "url";
import { pool } from "../src/lib/db.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const MIG_DIR = path.join(__dirname, "migrations");

async function run(){
  const files = fs.readdirSync(MIG_DIR).filter(f=>f.endsWith(".sql")).sort();
  for(const f of files){
    const sql = fs.readFileSync(path.join(MIG_DIR,f),"utf8");
    console.log(">> applying", f);
    await pool.query(sql);
  }
  console.log("done.");
  await pool.end();
}
run().catch(e=>{ console.error(e); process.exit(1); });
