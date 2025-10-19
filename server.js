import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { customAlphabet } from 'nanoid';
import Stripe from 'stripe';

dotenv.config();
const app = express();
app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));

// CORS
const allowed = process.env.ALLOWED_ORIGINS ? JSON.parse(process.env.ALLOWED_ORIGINS) : ["*"];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowed.includes("*") || allowed.includes(origin)) return cb(null, true);
    return cb(new Error("CORS: Origin not allowed: " + origin));
  },
  credentials: true
}));

const state = {
  homes: new Map(),          // homeId -> { devices: Map, modem, alerts: [], geofences: [], locations: Map(deviceId -> [points]) }
  actions: [],               // queued actions for agents
  signups: [],
  customers: new Map(),
  subscriptions: []
};
const nanoid = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 10);

const JWT_SECRET = process.env.JWT_SECRET || 'demo_jwt_secret_change_me';
const TASK_SECRET = process.env.TASK_SECRET || 'demo_task_secret_change_me';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_PRICE_ID   = process.env.STRIPE_PRICE_ID   || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

function ensureHome(homeId) {
  if (!state.homes.has(homeId)) {
    state.homes.set(homeId, { devices: new Map(), modem: null, alerts: [], geofences: [], locations: new Map() });
  }
  return state.homes.get(homeId);
}
function authTask(req, res, next) {
  const header = req.get('x-task-secret');
  if (header && header === TASK_SECRET) return next();
  res.status(401).json({ error: 'Unauthorized (task)' });
}
function authJWT(req, res, next) {
  const auth = req.get('authorization');
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing bearer token' });
  try {
    const token = auth.slice(7);
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Health
app.get(['/','/api/health','/api/ping'], (req, res) => {
  res.json({ ok: true, time: new Date().toISOString(), service: 'ApagaNet Backend PRO (locations)' });
});

// Auth demo token
app.post('/auth/demo-token', (req, res) => {
  const { homeId = 'HOME-DEMO-1' } = req.body || {};
  const token = jwt.sign({ role: 'admin', homeId }, JWT_SECRET, { expiresIn: '2h' });
  res.json({ token, homeId });
});

// Devices minimal (kept)
app.get('/devices', authJWT, (req, res) => {
  const home = ensureHome(req.user.homeId);
  const devices = Array.from(home.devices.values()).sort((a,b)=>b.lastSeen-a.lastSeen);
  res.json({ devices });
});

// Alerts
app.get('/alerts', authJWT, (req, res) => {
  const home = ensureHome(req.user.homeId);
  res.json({ alerts: home.alerts });
});

// ---------- Locations ----------
// POST /locations/report  {deviceId, lat, lng, accuracy?, battery?, at?}
app.post('/locations/report', (req, res) => {
  const { homeId, deviceId, lat, lng, accuracy=30, battery=null, at=null } = req.body || {};
  if (!homeId || !deviceId || typeof lat!=='number' || typeof lng!=='number') {
    return res.status(400).json({ error: 'homeId, deviceId, lat, lng required' });
  }
  const home = ensureHome(homeId);
  const t = at ? +at : Date.now();
  const point = { id: nanoid(), deviceId, lat, lng, accuracy, battery, at: t };
  if (!home.locations.has(deviceId)) home.locations.set(deviceId, []);
  const list = home.locations.get(deviceId);
  list.push(point);
  // Keep last 1000 pts per device in memory
  if (list.length > 1000) list.splice(0, list.length-1000);
  // Geofence enter/exit alerts
  for (const gf of home.geofences) {
    const inside = haversineInRadius(lat, lng, gf.lat, gf.lng, gf.radiusMeters);
    const lastInside = list.length>1 ? haversineInRadius(list[list.length-2].lat, list[list.length-2].lng, gf.lat, gf.lng, gf.radiusMeters) : false;
    if (inside && !lastInside) {
      home.alerts.unshift({ id:nanoid(), homeId, type:'geofence_enter', message:`${deviceId} entró a ${gf.name}`, createdAt:t, read:false });
    }
    if (!inside && lastInside) {
      home.alerts.unshift({ id:nanoid(), homeId, type:'geofence_exit', message:`${deviceId} salió de ${gf.name}`, createdAt:t, read:false });
    }
  }
  res.json({ ok:true });
});

// GET /locations/live?deviceId=...  -> last point
app.get('/locations/live', authJWT, (req, res) => {
  const home = ensureHome(req.user.homeId);
  const { deviceId } = req.query;
  if (!deviceId) return res.status(400).json({ error:'deviceId required' });
  const list = home.locations.get(deviceId) || [];
  res.json({ live: list[list.length-1] || null });
});

// GET /locations/history?deviceId=...&since=ms&until=ms&limit=500
app.get('/locations/history', authJWT, (req, res) => {
  const home = ensureHome(req.user.homeId);
  const { deviceId, since=0, until=Date.now(), limit=500 } = req.query;
  if (!deviceId) return res.status(400).json({ error:'deviceId required' });
  const list = (home.locations.get(deviceId) || []).filter(p => p.at >= +since && p.at <= +until);
  res.json({ points: list.slice(-(+limit)) });
});

// Geofences CRUD (memory)
// GET /geofences
app.get('/geofences', authJWT, (req, res) => {
  const home = ensureHome(req.user.homeId);
  res.json({ geofences: home.geofences });
});
// POST /geofences {name, lat, lng, radiusMeters}
app.post('/geofences', authJWT, (req, res) => {
  const { name, lat, lng, radiusMeters=150 } = req.body || {};
  if (!name || typeof lat!=='number' || typeof lng!=='number') return res.status(400).json({ error:'name, lat, lng required' });
  const home = ensureHome(req.user.homeId);
  const gf = { id:nanoid(), name, lat, lng, radiusMeters };
  home.geofences.push(gf);
  res.json({ ok:true, geofence: gf });
});
// DELETE /geofences/:id
app.delete('/geofences/:id', authJWT, (req, res) => {
  const home = ensureHome(req.user.homeId);
  const { id } = req.params;
  home.geofences = home.geofences.filter(g => g.id !== id);
  res.json({ ok:true });
});

// Haversine helper
function haversineInRadius(lat1,lng1,lat2,lng2, radiusMeters){
  const R = 6371000;
  const dLat = (lat2-lat1)*Math.PI/180;
  const dLng = (lng2-lng1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  const c = 2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  const d = R*c;
  return d <= radiusMeters;
}

// Public signup + billing (same idea)
app.post('/public/signup', (req,res)=>{
  const { email, family } = req.body || {};
  if(!email) return res.status(400).json({ error:'email required' });
  state.signups.push({ email, family: family||'', createdAt: Date.now() });
  res.json({ ok:true });
});
app.post('/billing/checkout', async (req,res)=>{
  try{
    if (!stripe || !STRIPE_PRICE_ID) return res.status(503).json({ error:'billing not configured' });
    const { email, origin } = req.body || {};
    if (!email) return res.status(400).json({ error:'email required' });
    const success = (origin || process.env.PUBLIC_ORIGIN || '').replace(/\/$/,'') + '/?status=success';
    const cancel  = (origin || process.env.PUBLIC_ORIGIN || '').replace(/\/$/,'') + '/?status=cancel';
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
      customer_email: email,
      success_url: success || 'https://example.com/?status=success',
      cancel_url: cancel || 'https://example.com/?status=cancel',
      metadata: { product: 'ApagaNet Single Plan' }
    });
    res.json({ url: session.url });
  }catch(e){
    console.error('checkout error', e);
    res.status(500).json({ error:'checkout_failed' });
  }
});

// Webhooks (raw JSON) — keep simple for demo; add signature verification in prod
app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), (req,res)=>{
  // In demo we accept and log (you can wire verification like in prior build)
  try{
    console.log('Webhook received len=', req.body?.length || 0);
  }catch(e){}
  res.json({ received:true });
});

// Seed sample
(function seed(){
  const homeId = 'HOME-DEMO-1';
  const h = ensureHome(homeId);
  const now = Date.now();
  ['AA:BB:CC:11:22:33','DE:AD:BE:EF:00:01','CA:FE:BA:BE:12:34'].forEach((mac,i)=>{
    h.devices.set(mac, { mac, name: ['Tablet Diego','Nintendo Switch','Laptop Mamá'][i], ip:'192.168.0.'+(10+i), online:true, lastSeen: now, pausedUntil:0 });
  });
  h.geofences.push({ id:nanoid(), name:'Escuela', lat:19.4326, lng:-99.1332, radiusMeters:250 });
})();

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log('ApagaNet Backend PRO (locations) on :'+PORT));
