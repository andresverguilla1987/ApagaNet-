// server.notify.js — ApagaNet Backend PRO (simple + notifications)
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { customAlphabet } from 'nanoid';
import Stripe from 'stripe';
import fetch from 'node-fetch';
import nodemailer from 'nodemailer';

dotenv.config();
const app = express();
app.use(morgan('dev'));

// CORS
const allowed = process.env.ALLOWED_ORIGINS ? JSON.parse(process.env.ALLOWED_ORIGINS) : ["*"];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowed.includes('*') || allowed.includes(origin)) return cb(null, true);
    return cb(new Error('CORS: Origin not allowed: ' + origin));
  },
  credentials: true
}));
app.options('*', cors());

// State (in-memory demo)
const state = {
  homes: new Map(), // homeId -> { devices: Map, alerts:[], geofences:[], locations: Map, guard: Map, notifications: [] }
  signups: [],
};
const nanoid = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 10);

// ENV / Stripe
const JWT_SECRET = process.env.JWT_SECRET || 'demo_jwt_secret_change_me';
const STRIPE_SECRET_KEY   = process.env.STRIPE_SECRET_KEY   || '';
const STRIPE_PRICE_ID     = process.env.STRIPE_PRICE_ID     || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' }) : null;

// Notifications ENV
const NOTIFY_WEBHOOK_URL = process.env.NOTIFY_WEBHOOK_URL || ''; // generic POST
const SLACK_WEBHOOK_URL  = process.env.SLACK_WEBHOOK_URL  || ''; // Slack Incoming Webhook
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = +(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || 'ApagaNet <no-reply@apaganet.local>';
const EMAIL_TO_DEFAULT = process.env.EMAIL_TO_DEFAULT || ''; // fallback recipient

let transporter = null;
if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

// Helpers
function ensureHome(homeId) {
  if (!state.homes.has(homeId)) {
    state.homes.set(homeId, {
      devices: new Map(),  // mac/id -> { mac,name,notifyHomeEnter:boolean,notifyHomeExit:boolean, ... }
      alerts: [],
      geofences: [],
      locations: new Map(), // deviceId -> [{lat,lng,accuracy,at}]
      guard: new Map(),     // deviceId -> {inside?, counter}
      notifications: [],    // log of notifications
      contacts: { email: EMAIL_TO_DEFAULT } // contact for emails (simple)
    });
  }
  return state.homes.get(homeId);
}
function authJWT(req, res, next) {
  const auth = req.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing bearer token' });
  try {
    const token = auth.slice(7);
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Health
app.get(['/','/api/health','/api/ping'], (req,res)=>{
  res.json({ ok:true, time:new Date().toISOString(), service:'ApagaNet Backend PRO (notify)' });
});

// Stripe webhook (raw)
app.post('/webhooks/stripe', express.raw({ type:'application/json' }), (req,res)=>{
  try {
    if (stripe && STRIPE_WEBHOOK_SECRET) {
      const sig = req.headers['stripe-signature'];
      stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    }
  } catch(e) {
    console.error('webhook error', e.message);
    return res.status(400).send(`Webhook Error: ${e.message}`);
  }
  res.json({ received:true });
});

app.use(express.json({ limit:'1mb' }));

// Auth demo
app.post('/auth/demo-token', (req,res)=>{
  const { homeId='HOME-DEMO-1' } = req.body || {};
  const token = jwt.sign({ role:'admin', homeId }, JWT_SECRET, { expiresIn:'2h' });
  res.json({ token, homeId });
});

// Devices (with notify prefs)
app.get('/devices', authJWT, (req,res)=>{
  const home = ensureHome(req.user.homeId);
  const devs = Array.from(home.devices.values());
  res.json({ devices: devs });
});

// Notifications: prefs per device
app.get('/notifications/prefs', authJWT, (req,res)=>{
  const home = ensureHome(req.user.homeId);
  const { deviceId } = req.query;
  if (!deviceId) return res.status(400).json({ error:'deviceId required' });
  const dev = home.devices.get(deviceId);
  if (!dev) return res.status(404).json({ error:'device not found' });
  res.json({
    deviceId,
    notifyHomeEnter: !!dev.notifyHomeEnter,
    notifyHomeExit:  !!dev.notifyHomeExit,
  });
});
app.post('/notifications/prefs', authJWT, (req,res)=>{
  const home = ensureHome(req.user.homeId);
  const { deviceId, notifyHomeEnter, notifyHomeExit } = req.body || {};
  if (!deviceId) return res.status(400).json({ error:'deviceId required' });
  const dev = home.devices.get(deviceId) || { mac: deviceId, name: deviceId };
  if (typeof notifyHomeEnter === 'boolean') dev.notifyHomeEnter = notifyHomeEnter;
  if (typeof notifyHomeExit === 'boolean')  dev.notifyHomeExit  = notifyHomeExit;
  home.devices.set(deviceId, dev);
  res.json({ ok:true, device: dev });
});

// Generic test
app.post('/notifications/test', authJWT, async (req,res)=>{
  const { message="Prueba de notificación ApagaNet" } = req.body || {};
  const home = ensureHome(req.user.homeId);
  const notif = { id:nanoid(), type:'test', message, createdAt: Date.now() };
  home.notifications.unshift(notif);
  await sendNotification(home, notif);
  res.json({ ok:true, delivered:true, notif });
});

// Notifier pipeline
async function sendNotification(home, { id, type, message, createdAt, deviceId=null }) {
  // 1) Generic webhook
  if (NOTIFY_WEBHOOK_URL) {
    try{
      await fetch(NOTIFY_WEBHOOK_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id, type, message, createdAt, deviceId })});
    }catch(e){ console.error('notify webhook error', e.message); }
  }
  // 2) Slack webhook (if set)
  if (SLACK_WEBHOOK_URL) {
    try{
      await fetch(SLACK_WEBHOOK_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ text: message })});
    }catch(e){ console.error('slack webhook error', e.message); }
  }
  // 3) Email (if SMTP configured)
  if (transporter && home.contacts?.email) {
    try{
      await transporter.sendMail({
        from: SMTP_FROM,
        to: home.contacts.email,
        subject: 'ApagaNet — Notificación',
        text: message,
      });
    }catch(e){ console.error('email error', e.message); }
  }
}

// Alerts
app.get('/alerts', authJWT, (req,res)=>{
  const home = ensureHome(req.user.homeId);
  res.json({ alerts: home.alerts });
});

// Locations & Geofences (simple)
const HYST_ENTER = 20; // m
const HYST_EXIT  = 50; // m
const MIN_ACC    = 100;
const MIN_SAMPLES = 3;

function distMeters(lat1,lng1,lat2,lng2){
  const R=6371000,toRad=d=>d*Math.PI/180;
  const dLat=toRad(lat2-lat1), dLng=toRad(lng2-lng1);
  const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(a));
}

app.post('/locations/report', (req,res)=>{
  const { homeId, deviceId, lat, lng, accuracy=30, at=null } = req.body || {};
  if (!homeId || !deviceId || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error:'homeId, deviceId, lat, lng required' });
  }
  if (accuracy != null && accuracy > MIN_ACC) return res.json({ ok:true, ignored:true, reason:'low_accuracy' });

  const home = ensureHome(homeId);
  const t = at ? +at : Date.now();
  const point = { id:nanoid(), deviceId, lat, lng, accuracy, at: t };

  if (!home.locations.has(deviceId)) home.locations.set(deviceId, []);
  const list = home.locations.get(deviceId);
  list.push(point);
  if (list.length > 1000) list.splice(0, list.length-1000);

  const homeFence = home.geofences.find(g => (g.name||'').toLowerCase()==='casa');
  if (homeFence) {
    const d = distMeters(lat,lng,homeFence.lat,homeFence.lng);
    const guard = home.guard.get(deviceId) || { inside:null, counter:0 };
    const insideNow = d <= (homeFence.radiusMeters - HYST_ENTER);
    const outsideNow = d >= (homeFence.radiusMeters + HYST_EXIT);
    let newInside = guard.inside;
    if (guard.inside === true) { if (outsideNow) newInside = false; }
    else if (guard.inside === false) { if (insideNow) newInside = true; }
    else { newInside = d <= homeFence.radiusMeters; }

    if (newInside !== guard.inside) {
      guard.counter += 1;
      if (guard.counter >= MIN_SAMPLES) {
        guard.inside = newInside;
        guard.counter = 0;
        const type = newInside ? 'geofence_enter' : 'geofence_exit';
        const message = newInside ? `${deviceId} llegó a Casa` : `${deviceId} salió de Casa`;
        const alert = { id:nanoid(), homeId, type, message, createdAt: t, read:false };
        home.alerts.unshift(alert);

        // Notify only if device prefs allow
        const dev = home.devices.get(deviceId) || {};
        const wantEnter = !!dev.notifyHomeEnter;
        const wantExit  = !!dev.notifyHomeExit;
        const allowed = (type==='geofence_enter' && wantEnter) || (type==='geofence_exit' && wantExit);
        if (allowed) {
          const notif = { id: alert.id, type, message, createdAt: t, deviceId };
          home.notifications.unshift(notif);
          sendNotification(home, notif);
        }
      }
    } else {
      guard.counter = 0;
    }
    home.guard.set(deviceId, guard);
  }

  res.json({ ok:true });
});

app.get('/locations/live', authJWT, (req,res)=>{
  const home = ensureHome(req.user.homeId);
  const { deviceId } = req.query;
  if (!deviceId) return res.status(400).json({ error:'deviceId required' });
  const list = home.locations.get(deviceId) || [];
  res.json({ live: list[list.length-1] || null });
});

app.get('/locations/history', authJWT, (req,res)=>{
  const home = ensureHome(req.user.homeId);
  const { deviceId, hours=24 } = req.query;
  if (!deviceId) return res.status(400).json({ error:'deviceId required' });
  const since = Date.now() - Number(hours)*60*60*1000;
  const pts = (home.locations.get(deviceId) || []).filter(p => p.at >= since && (p.accuracy==null || p.accuracy<=MIN_ACC));
  res.json({ points: pts });
});

app.get('/geofences', authJWT, (req,res)=>{
  const home = ensureHome(req.user.homeId);
  res.json({ geofences: home.geofences });
});
app.post('/geofences', authJWT, (req,res)=>{
  const { name, lat, lng, radiusMeters=200 } = req.body || {};
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return res.status(400).json({ error:'name, lat, lng required' });
  const home = ensureHome(req.user.homeId);
  const gf = { id:nanoid(), name, lat, lng, radiusMeters };
  home.geofences.push(gf);
  res.json({ ok:true, geofence: gf });
});
app.post('/geofences/upsert-home', authJWT, (req,res)=>{
  const { lat, lng, radiusMeters=200 } = req.body || {};
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return res.status(400).json({ error:'lat,lng required' });
  const home = ensureHome(req.user.homeId);
  const idx = home.geofences.findIndex(g => (g.name||'').toLowerCase()==='casa');
  const gf = { id:nanoid(), name:'Casa', lat, lng, radiusMeters };
  if (idx>=0) home.geofences[idx] = { ...gf, id: home.geofences[idx].id };
  else home.geofences.push(gf);
  res.json({ ok:true, geofence: idx>=0 ? home.geofences[idx] : gf });
});

// Public/signup
app.post('/public/signup', (req,res)=>{
  const { email, family } = req.body || {};
  if(!email) return res.status(400).json({ error:'email required' });
  state.signups.push({ email, family: family||'', createdAt: Date.now() });
  res.json({ ok:true });
});

// Seed demo
(function seed(){
  const homeId = 'HOME-DEMO-1';
  const h = ensureHome(homeId);
  const now = Date.now();
  ['Tablet Diego','Nintendo Switch','Laptop Mamá'].forEach((name,i)=>{
    h.devices.set(name, { mac:name, name, online:true, lastSeen:now, pausedUntil:0, notifyHomeEnter:true, notifyHomeExit:true });
  });
  h.geofences.push({ id:nanoid(), name:'Escuela', lat:19.4326, lng:-99.1332, radiusMeters:250 });
})();

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log('ApagaNet Backend PRO (notify) on :' + PORT));
