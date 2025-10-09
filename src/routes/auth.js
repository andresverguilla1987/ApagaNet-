import express from 'express'; const router = express.Router(); router.post('/login', (req,res)=>res.json({ok:false,error:'stub'})); export default router;
