export function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }
export function now(){ return new Date().toISOString(); }
export function pick(o, keys){ const r={}; for(const k of keys) r[k]=o[k]; return r; }
export function log(...a){ console.log(new Date().toISOString(), ...a); }