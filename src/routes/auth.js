import express from "express";
import jwt from "jsonwebtoken";
import { pool } from "../lib/db.js";

const router = express.Router();

router.post("/login", async (req,res)=>{
  try{
    const { email, name } = req.body || {};
    if(!email) return res.status(400).json({ ok:false, error:"email required" });

    let u = await pool.query("select id,email,name from users where email=$1", [email]);
    if(!u.rowCount){
      u = await pool.query("insert into users(email,name) values ($1,$2) returning id,email,name", [email, name||null]);
    }
    const user = u.rows[0];
    const token = jwt.sign({ id:user.id, email:user.email }, process.env.JWT_SECRET||"dev-secret", { expiresIn:"7d" });
    res.json({ ok:true, token, user });
  }catch(e){ res.status(500).json({ ok:false, error:String(e) });}
});

export default router;
