// server.notify.integrated.js — Backend integrado (Notify + Quiet Hours + Export CSV; memoria)
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { customAlphabet } from 'nanoid';
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

// State (in-memory)
const state = {
  homes: new Map() // homeId -> { devices:Map, alerts:[], geofences:[], locations:Map, guard:Map, qh:{enabled,start,end}, contacts:{} }
};
const nanoid = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 10);

const JWT_SECRET = process.env.JWT_SECRET || 'demo_jwt_secret_change_me';

// Notifications ENV
const NOTIFY_WEBHOOK_URL = process.env.NOTIFY_WEBHOOK_URL || '';
const SLACK_WEBHOOK_URL  = process.env.SLACK_WEBHOOK_URL  || '';
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = +(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || 'ApagaNet <no-reply@apaganet.local>';
const EMAIL_TO_DEFAULT = process.env.EMAIL_TO_DEFAULT || '';
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
function ensureHome(homeId){
  if (!state.homes.has(homeId)){
    state.homes.set(homeId, {
      devices: new Map(),
      alerts: [],
      geofences: [],
      locations: new Map(),
      guard: new Map(),
      qh: { enabled:false, start:'22:00', end:'07:00' },
      contacts: { email: EMAIL_TO_DEFAULT }
    });
  }
  return state.homes.get(homeId);
}
function authJWT(req,res,next){
  const a = req.get('authorization')||'';
  if (!a.startsWith('Bearer ')) return res.status(401).json({ error:'Missing bearer token' });
  try{ req.user = jwt.verify(a.slice(7), JWT_SECRET); next(); }
  catch{ return res.status(401).json({ error:'Invalid token' }); }
}
function distMeters(lat1,lng1,lat2,lng2){
  const R=6371000,toRad=d=>d*Math.PI/180;
  const dLat=toRad(lat2-lat1), dLng=toRad(lng2-lng1);
  const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(a));
}
async function sendNotification(home, { id, type, message, createdAt, deviceId=null }){
  if (NOTIFY_WEBHOOK_URL){ try{ await fetch(NOTIFY_WEBHOOK_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,type,message,createdAt,deviceId})}); }catch{} }
  if (SLACK_WEBHOOK_URL){ try{ await fetch(SLACK_WEBHOOK_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:message})}); }catch{} }
  if (transporter && home.contacts?.email){ try{ await transporter.sendMail({from:SMTP_FROM,to:home.contacts.email,subject:'ApagaNet — Notificación',text:message}); }catch{} }
}
function withinQuietHours(qh){
  if (!qh?.enabled) return false;
  const now = new Date();
  const [sh,sm]=qh.start.split(':').map(Number);
  const [eh,em]=qh.end.split(':').map(Number);
  const start = new Date(now); start.setHours(sh, sm||0, 0, 0);
  const end   = new Date(now); end.setHours(eh, em||0, 0, 0);
  return (start <= end) ? (now >= start && now <= end) : (now >= start || now <= end);
}

// Health
app.get(['/','/api/health','/api/ping'], (req,res)=> res.json({ ok:true, time:new Date().toISOString(), service:'ApagaNet Backend (integrated)' }));

app.use(express.json({ limit:'1mb' }));

// Auth demo
app.post('/auth/demo-token', (req,res)=>{
  const { homeId='HOME-DEMO-1' } = req.body || {};
  ensureHome(homeId);
  const token = jwt.sign({ role:'admin', homeId }, JWT_SECRET, { expiresIn:'2h' });
  res.json({ token, homeId });
});

// Devices
app.get('/devices', authJWT, (req,res)=>{
  const home = ensureHome(req.user.homeId);
  const devices = Array.from(home.devices.values()).map(d => ({
    mac: d.mac, name: d.name, online: !!d.online, lastSeen: d.lastSeen||Date.now(), pausedUntil: d.pausedUntil||0
  }));
  res.json({ devices });
});

// Alerts
app.get('/alerts', authJWT, (req,res)=>{
  const home = ensureHome(req.user.homeId);
  res.json({ alerts: home.alerts.slice(0,200) });
});

// Notifications prefs
app.get('/notifications/prefs', authJWT, (req,res)=>{
  const { deviceId } = req.query;
  if (!deviceId) return res.status(400).json({ error:'deviceId required' });
  const home = ensureHome(req.user.homeId);
  const dev = home.devices.get(deviceId) || { mac:deviceId, name:deviceId, notifyHomeEnter:true, notifyHomeExit:true };
  res.json({ deviceId, notifyHomeEnter: !!dev.notifyHomeEnter, notifyHomeExit: !!dev.notifyHomeExit });
});
app.post('/notifications/prefs', authJWT, (req,res)=>{
  const { deviceId, notifyHomeEnter=null, notifyHomeExit=null } = req.body || {};
  if (!deviceId) return res.status(400).json({ error:'deviceId required' });
  const home = ensureHome(req.user.homeId);
  const dev = home.devices.get(deviceId) || { mac:deviceId, name:deviceId, online:true, lastSeen:Date.now(), pausedUntil:0, notifyHomeEnter:true, notifyHomeExit:true };
  if (typeof notifyHomeEnter === 'boolean') dev.notifyHomeEnter = notifyHomeEnter;
  if (typeof notifyHomeExit === 'boolean')  dev.notifyHomeExit  = notifyHomeExit;
  home.devices.set(deviceId, dev);
  res.json({ ok:true, device: { deviceId, notifyHomeEnter:dev.notifyHomeEnter, notifyHomeExit:dev.notifyHomeExit } });
});

// Quiet Hours endpoints
app.get('/notifications/quiet-hours', authJWT, (req,res)=>{
  const home = ensureHome(req.user.homeId);
  res.json({ enabled: home.qh.enabled, start: home.qh.start, end: home.qh.end });
});
app.post('/notifications/quiet-hours', authJWT, (req,res)=>{
  const home = ensureHome(req.user.homeId);
  const { enabled=true, start='22:00', end='07:00' } = req.body || {};
  home.qh = { enabled, start, end };
  res.json({ ok:true, enabled, start, end });
});

// Locations & Geofences
const HYST_ENTER=20, HYST_EXIT=50, MIN_ACC=100, MIN_SAMPLES=3;
app.post('/locations/report', (req,res)=>{
  const { homeId, deviceId, lat, lng, accuracy=30, at=null } = req.body || {};
  if (!homeId || !deviceId || !Number.isFinite(lat) || !Number.isFinite(lng)) return res.status(400).json({ error:'homeId, deviceId, lat, lng required' });
  if (accuracy != null && accuracy > MIN_ACC) return res.json({ ok:true, ignored:true, reason:'low_accuracy' });
  const home = ensureHome(homeId);
  const t = at ? +at : Date.now();
  if (!home.locations.has(deviceId)) home.locations.set(deviceId, []);
  const list = home.locations.get(deviceId);
  const point = { id:nanoid(), deviceId, lat, lng, accuracy, at:t };
  list.push(point); if (list.length>2000) list.splice(0, list.length-2000);
  // auto-register device name if absent
  if (!home.devices.has(deviceId)) home.devices.set(deviceId, { mac:deviceId, name:deviceId, online:true, lastSeen:t, pausedUntil:0, notifyHomeEnter:true, notifyHomeExit:true });
  // geofence Casa
  const gf = home.geofences.find(g => (g.name||'').toLowerCase()==='casa');
  if (gf){
    const d = distMeters(lat,lng,gf.lat,gf.lng);
    const guard = home.guard.get(deviceId) || { inside:null, counter:0 };
    const insideNow = d <= (gf.radiusMeters - HYST_ENTER);
    const outsideNow = d >= (gf.radiusMeters + HYST_EXIT);
    let newInside = guard.inside;
    if (guard.inside === true) { if (outsideNow) newInside = false; }
    else if (guard.inside === false) { if (insideNow) newInside = true; }
    else { newInside = d <= gf.radiusMeters; }
    let event = null;
    if (newInside !== guard.inside){
      guard.counter += 1;
      if (guard.counter >= MIN_SAMPLES){
        guard.inside = newInside; guard.counter = 0;
        event = newInside ? 'geofence_enter' : 'geofence_exit';
        const message = newInside ? `${deviceId} llegó a Casa` : `${deviceId} salió de Casa`;
        const alert = { id:nanoid(), homeId, type:event, message, createdAt:t, read:false };
        home.alerts.unshift(alert);
        // deliver? check prefs + quiet hours
        const dev = home.devices.get(deviceId) || {};
        const wantEnter = !!dev.notifyHomeEnter, wantExit = !!dev.notifyHomeExit;
        const allowed = (event==='geofence_enter' && wantEnter) || (event==='geofence_exit' && wantExit);
        if (allowed && !withinQuietHours(home.qh)){
          sendNotification(home, { id: alert.id, type:event, message, createdAt:t, deviceId });
        }
      }
    } else { guard.counter = 0; }
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
  const since = Date.now() - Number(hours)*3600*1000;
  const pts = (home.locations.get(deviceId)||[]).filter(p=>p.at>=since && (p.accuracy==null || p.accuracy<=MIN_ACC));
  res.json({ points: pts });
});

// Export CSV (integrated)
app.get('/locations/export.csv', authJWT, (req,res)=>{
  const home = ensureHome(req.user.homeId);
  const { deviceId, hours=24 } = req.query;
  if (!deviceId) return res.status(400).json({ error:'deviceId required' });
  const since = Date.now() - Number(hours)*3600*1000;
  const pts = (home.locations.get(deviceId)||[]).filter(p=>p.at>=since);
  const rows = [['lat','lng','accuracy','at']].concat(pts.map(p=>[p.lat,p.lng,p.accuracy??'', new Date(p.at).toISOString()]));
  const csv = rows.map(r=>r.join(',')).join('\n');
  res.setHeader('Content-Type','text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="locations_${deviceId}_${hours}h.csv"`);
  res.send(csv);
});

// Geofences
app.get('/geofences', authJWT, (req,res)=>{
  const home = ensureHome(req.user.homeId);
  res.json({ geofences: home.geofences });
});
app.post('/geofences', authJWT, (req,res)=>{
  const home = ensureHome(req.user.homeId);
  const { name, lat, lng, radiusMeters=200 } = req.body || {};
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return res.status(400).json({ error:'name, lat, lng required' });
  const gf = { id:nanoid(), name, lat, lng, radiusMeters };
  home.geofences.push(gf);
  res.json({ ok:true, geofence: gf });
});
app.post('/geofences/upsert-home', authJWT, (req,res)=>{
  const home = ensureHome(req.user.homeId);
  const { lat, lng, radiusMeters=200 } = req.body || {};
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return res.status(400).json({ error:'lat,lng required' });
  const idx = home.geofences.findIndex(g => (g.name||'').toLowerCase()==='casa');
  const gf = { id:nanoid(), name:'Casa', lat, lng, radiusMeters };
  if (idx>=0) home.geofences[idx] = { ...gf, id: home.geofences[idx].id };
  else home.geofences.push(gf);
  res.json({ ok:true, geofence: idx>=0 ? home.geofences[idx] : gf });
});

// Notifications test
app.post('/notifications/test', authJWT, async (req,res)=>{
  const home = ensureHome(req.user.homeId);
  const { message="Prueba de notificación ApagaNet" } = req.body || {};
  if (!withinQuietHours(home.qh)){
    await sendNotification(home, { id:nanoid(), type:'test', message, createdAt:Date.now() });
  }
  res.json({ ok:true, delivered: !withinQuietHours(home.qh) });
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
app.listen(PORT, ()=> console.log('ApagaNet Backend (integrated) on :' + PORT));
