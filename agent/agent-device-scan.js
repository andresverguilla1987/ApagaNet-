/**
 * agent-device-scan.js
 * Node 18+ script to discover devices in the local LAN and report to backend.
 * Requirements: nmap (for ping scan), arp, optionally avahi-browse or nmblookup for names (not required).
 *
 * Usage:
 *   export APAGANET_URL="https://apaganet-zmsa.onrender.com"
 *   export AGENT_TOKEN="<AGENT_TOKEN>"
 *   export AGENT_ID="house-1"
 *   node agent-device-scan.js
 *
 * The script performs a ping sweep (nmap -sn) on the local /24 network, reads ARP table,
 * and produces a devices array: [{ ip, mac, hostname, vendor, last_seen }...]
 */

import { execSync, spawnSync } from 'child_process';
import os from 'os';
const fetch = (...a) => import('node-fetch').then(m=>m.default(...a));

function getGateway() {
  try {
    return execSync("ip -4 route show default | awk '/default/ {print $3; exit}'").toString().trim();
  } catch(e) { return null; }
}

function cidrBase(ip) {
  const parts = ip.split('.').slice(0,3);
  return parts.join('.') + '.0/24';
}

function runNmapPing(base) {
  try {
    // -sn ping scan, -n no DNS, -oG - grepable to parse, timeout safe
    const r = spawnSync('nmap', ['-sn','-n','-T3','-oG','-','--host-timeout','30s', base], { encoding: 'utf8', timeout: 120000 });
    return r.stdout || '';
  } catch(e) {
    console.error('nmap failed', e);
    return '';
  }
}

function parseNmapGrep(output) {
  const devices = [];
  const lines = output.split('\n');
  for (const line of lines) {
    if (!line.startsWith('Host:')) continue;
    // Host: 192.168.1.10 (device-name)  Status: Up
    const m = line.match(/^Host:\s+([0-9\.]+)\s+\(([^)]*)\)\s+Status:\s+Up/);
    if (m) {
      const ip = m[1];
      const name = m[2] && m[2] !== '()' ? m[2] : null;
      // try to extract MAC if present in the line after 'Status:' (nmap greppable may include 'MAC:...')
      const macMatch = line.match(/MAC:\s+([0-9A-Fa-f:]+)/);
      const mac = macMatch ? macMatch[1] : null;
      devices.push({ ip, hostname: name, mac });
    }
  }
  return devices;
}

function readArp() {
  try {
    const out = execSync('arp -n', { encoding: 'utf8' });
    // sample line: 192.168.1.10 ether aa:bb:cc:dd:ee:ff C eth0
    const devices = [];
    out.split('\n').forEach(line=>{
      const m = line.match(/([0-9\.]+)\s+.*?([0-9A-Fa-f:]{17})/);
      if (m) devices.push({ ip: m[1], mac: m[2].toUpperCase() });
    });
    return devices;
  } catch(e) { return []; }
}

function macVendorLookup(mac) {
  // naive OUI vendor via local `ipcalc` or fallback null. Real implementation should use an OUI DB.
  return null;
}

async function reportToServer(payload) {
  const BASE = process.env.APAGANET_URL || 'http://localhost:10000';
  const TOKEN = process.env.AGENT_TOKEN || '';
  try {
    const res = await fetch(BASE + '/agents/report-devices', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization': 'Bearer ' + TOKEN },
      body: JSON.stringify(payload)
    });
    console.log('report status', res.status);
    try { console.log(await res.json()); } catch(e){}
  } catch(e) {
    console.error('report failed', e);
  }
}

(async ()=>{
  const gw = getGateway();
  if (!gw) { console.error('no gateway found, aborting'); process.exit(1); }
  const base = cidrBase(gw);
  console.log('gateway', gw, 'cidr', base);

  const nmapOut = runNmapPing(base);
  const nmapDevices = parseNmapGrep(nmapOut);
  const arpDevices = readArp();

  // merge by IP prefer hostname from nmap, mac from arp
  const map = new Map();
  for (const d of nmapDevices) map.set(d.ip, { ip: d.ip, hostname: d.hostname || null, mac: d.mac || null, last_seen: new Date().toISOString() });
  for (const a of arpDevices) {
    const e = map.get(a.ip) || { ip: a.ip, hostname: null, last_seen: new Date().toISOString() };
    e.mac = e.mac || a.mac;
    map.set(a.ip, e);
  }

  const devices = Array.from(map.values()).map(d => ({ ip: d.ip, mac: d.mac || null, hostname: d.hostname || null, last_seen: d.last_seen }));

  // Optional: enrich vendor (not implemented)
  // devices.forEach(d=> d.vendor = macVendorLookup(d.mac));

  const payload = { agent_id: process.env.AGENT_ID || null, devices, timestamp: new Date().toISOString() };
  console.log('devices discovered', devices.length);
  await reportToServer(payload);
})();
