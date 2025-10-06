import express from "express";
import { pool } from "../lib/db.js";

const router = express.Router();

router.get("/", async (req,res)=>{
  try{
    const r=await pool.query("select d.* from devices d where d.user_id=$1 order by d.created_at desc", [req.user.id]);
    res.json({ ok:true, devices:r.rows });
  }catch(e){ res.status(500).json({ ok:false, error:String(e) });}
});

router.post("/", async (req,res)=>{
  try{
    const { name, mac, vendor } = req.body || {};
    if(!name||!mac) return res.status(400).json({ ok:false, error:"name and mac required" });
    const r=await pool.query(
      "insert into devices(user_id,name,mac,vendor) values ($1,$2,$3,$4) returning *",
      [req.user.id, name, mac, vendor||null]
    );
    res.json({ ok:true, device:r.rows[0] });
  }catch(e){ res.status(500).json({ ok:false, error:String(e) });}
});

export default router;
