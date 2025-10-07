import express from "express";
import jwt from "jsonwebtoken";
const router = express.Router();

router.post("/login", (req, res) => {
  const { email = "demo@apaganet.app" } = req.body || {};
  const token = jwt.sign({ uid: email }, process.env.JWT_SECRET || "dev-secret", { expiresIn: "7d" });
  res.json({ ok: true, token });
});

export default router;
