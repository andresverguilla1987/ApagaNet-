import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import compression from "compression";
import jwt from "jsonwebtoken";
import { pool } from "./src/lib/db.js";

import auth from "./src/routes/auth.js";
import devices from "./src/routes/devices.js";
import schedules from "./src/routes/schedules.js";
import agents from "./src/routes/agents.js";
import admin from "./src/routes/admin.js";

const app = express();
const PORT = Number(process.env.PORT) || 10000;
const ORIGINS = (process.env.CORS_ORIGINS || "").split(/[\s,]+/).map(s=>s.trim()).filter(Boolean);

app.set("trust proxy", 1);
app.use(helmet());
app.use(cors(ORIGINS.length ? { origin: ORIGINS } : {}));
app.use(express.json());
app.use(compression());
app.use(morgan("dev"));
app.use(rateLimit({ windowMs: 60_000, max: 200 }));

app.get("/", (_req,res)=>res.send("ApagaNet API OK"));
app.get("/ping", async (_req,res)=>{
  try{
    const r = await pool.query("select 1 as ok");
    res.json({ ok:true, db: r.rows?.[0]?.ok === 1, version:"0.6.0" });
  }catch(e){ res.status(500).json({ ok:false, error: String(e) }); }
});

function requireJWT(req,res,next){
  const h=req.headers.authorization||"";
  const t=h.startsWith("Bearer ")?h.slice(7):null;
  if(!t) return res.status(401).json({ok:false,error:"No token"});
  try{ req.user=jwt.verify(t,process.env.JWT_SECRET||"dev-secret"); next(); }
  catch{ return res.status(401).json({ok:false,error:"Invalid token"}); }
}
function requireTaskSecret(req,res,next){
  const h=req.headers.authorization||"";
  const t=h.startsWith("Bearer ")?h.slice(7):null;
  if(!t || t !== (process.env.TASK_SECRET||"")) return res.sendStatus(401);
  next();
}

app.use("/auth", auth);
app.use("/devices", requireJWT, devices);
app.use("/schedules", requireJWT, schedules);
app.use("/agents", agents);
app.use("/admin", requireTaskSecret, admin);

app.post("/tasks/run-scheduler", requireTaskSecret, async (_req,res)=>{
  await pool.query("insert into schedule_runs(ran_at,checked,set_blocked,set_unblocked) values (now(),0,0,0)");
  res.json({ ok:true, ranAt:new Date().toISOString() });
});

app.use((_req,res)=>res.status(404).json({ ok:false, error:"Not found" }));
app.use((err,_req,res,_next)=>{ console.error(err); res.status(500).json({ ok:false, error:"Server error" }); });

app.listen(PORT,"0.0.0.0",()=>console.log("ApagaNet API ready on :"+PORT));
