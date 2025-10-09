import express from 'express'; const router = express.Router(); router.get('/', (req,res)=> res.json({ok:true,schedules:[]})); export default router;
