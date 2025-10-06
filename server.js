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

const app = express();
const PORT = Number(process.env.PORT)||10000;
const ORIGINS=(process.env.CORS_ORIGINS||"").split(",").filter(Boolean);

app.use(helmet());
app.use(cors(ORIGINS.length?{origin:ORIGINS}:{ }));
app.use(express.json());
app.use(compression());
app.use(morgan("dev"));
app.use(rateLimit({ windowMs:60_000, max:200 }));

app.get("/", (_req,res)=>res.send("ApagaNet API OK"));
app.get("/ping", async (_req,res)=>{
  try {
    const r = await pool.query("select 1 as ok");
    res.json({ ok:true, db:r.rows[0].ok===1, version:"0.3.0-ready" });
  } catch(e){ res.status(500).json({ ok:false, error:String(e) });}
});

// Auth middleware (simple)
export function requireAuth(req,res,next){
  const h=req.headers.authorization||"";
  const token=h.startsWith("Bearer ")?h.slice(7):null;
  if(!token) return res.status(401).json({ok:false,error:"No token"});
  try{
    req.user=jwt.verify(token, process.env.JWT_SECRET||"dev-secret");
    next();
  }catch(e){ return res.status(401).json({ok:false,error:"Invalid token"});}
}

// Routes
app.use("/auth", auth);
app.use("/devices", requireAuth, devices);
app.use("/schedules", requireAuth, schedules);

// Manual scheduler trigger (POST + Bearer TASK_SECRET)
app.post("/tasks/run-scheduler", async (req,res)=>{
  const h=req.headers.authorization||"";
  const token=h.startsWith("Bearer ")?h.slice(7):null;
  if(!token || token!==process.env.TASK_SECRET) return res.sendStatus(401);

  // Very simple demo: just record a run (actual logic should compute block/unblock)
  const checked = 0, set_blocked=0, set_unblocked=0;
  await pool.query(
    "insert into schedule_runs(ran_at,checked,set_blocked,set_unblocked) values (now(),$1,$2,$3)",
    [checked,set_blocked,set_unblocked]
  );
  res.json({ ok:true, ranAt:new Date().toISOString() });
});

// Optional debug endpoints
app.get("/debug/devices", async (_req,res)=>{
  try{
    const r=await pool.query("select id,name,mac,blocked,updated_at from devices order by updated_at desc limit 50");
    res.json({ ok:true, devices:r.rows });
  }catch(e){ res.status(500).json({ ok:false, error:String(e) });}
});

app.get("/debug/actions", async (_req,res)=>{
  try{
    const r=await pool.query("select * from actions order by created_at desc limit 50");
    res.json({ ok:true, actions:r.rows });
  }catch(e){ res.status(500).json({ ok:false, error:String(e) });}
});

process.on("unhandledRejection", e=>console.error("unhandledRejection",e));
process.on("uncaughtException", e=>console.error("uncaughtException",e));

app.listen(PORT,"0.0.0.0",()=>console.log("ApagaNet API ready on :"+PORT));
