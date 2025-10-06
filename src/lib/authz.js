// src/lib/authz.js — JWT middleware
import jwt from "jsonwebtoken";

export function requireAuth(req, res, next){
  try {
    const h = req.headers.authorization || "";
    const token = h.startsWith("Bearer ") ? h.slice(7) : null;
    if(!token) return res.status(401).json({ ok:false, error:"missing token" });
    const { uid } = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = uid;
    next();
  } catch (e) {
    return res.status(401).json({ ok:false, error:"invalid token" });
  }
}
