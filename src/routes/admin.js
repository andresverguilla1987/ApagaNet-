import express from 'express'; const router = express.Router(); router.get('/users', (req,res)=> res.status(401).json({ok:false,error:'admin token required'})); export default router;
