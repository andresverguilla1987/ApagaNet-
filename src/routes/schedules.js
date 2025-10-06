import express from "express";
import { pool } from "../lib/db.js";

const router = express.Router();

router.get("/", async (req,res)=>{
  try{
    const r=await pool.query(
      "select s.* from schedules s where s.user_id=$1 order by s.created_at desc",
      [req.user.id]
    );
    res.json({ ok:true, schedules:r.rows });
  }catch(e){ res.status(500).json({ ok:false, error:String(e) });}
});

router.post("/", async (req,res)=>{
  try{
    const { deviceId, blockFrom, blockTo, days, active } = req.body||{};
    if(!deviceId||!blockFrom||!blockTo) return res.status(400).json({ ok:false, error:"deviceId, blockFrom, blockTo required" });
    const r=await pool.query(
      "insert into schedules(user_id,device_id,block_from,block_to,days,active) values ($1,$2,$3,$4,$5,$6) returning *",
      [req.user.id, deviceId, blockFrom, blockTo, Array.isArray(days)&&days.length?days:[1,2,3,4,5,6,7], active!==false]
    );
    res.json({ ok:true, schedule:r.rows[0] });
  }catch(e){ res.status(500).json({ ok:false, error:String(e) });}
});

export default router;
