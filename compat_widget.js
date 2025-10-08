// compat_widget.js - robust widget to call backend endpoints and render compatibility
(function(){
  function getBase(){ return window.APAGANET_BASE_URL || ''; }
  const BASE = getBase();
  function el(id){ return document.getElementById(id); }
  function showDebug(msg){
    try { const d = document.getElementById('debug'); if(d) d.textContent = (new Date()).toISOString() + ' | ' + msg + '\n' + d.textContent; } catch(e){};
    console.log('[compat-fixed]', msg);
  }
  async function safeFetch(path, adminToken) {
    try {
      const res = await fetch(BASE + path, { headers: adminToken ? { Authorization: 'Bearer ' + adminToken } : {} });
      const txt = await res.text();
      let body = txt;
      try { body = JSON.parse(txt); } catch(e){}
      return { ok:res.ok, status: res.status, statusText: res.statusText, body };
    } catch (e) {
      return { ok:false, error: e.message||String(e) };
    }
  }

  function bindButtonOnce() {
    const btn = document.getElementById('btnCheckCompatibility');
    if (!btn) return false;
    if (btn.__apaganet_bound) { showDebug('Botón ya enlazado'); return true; }
    btn.__apaganet_bound = true;
    btn.addEventListener('click', async function(){
      showDebug('Botón pulsado');
      if (!BASE) { el('compatResult').innerHTML = '<div style="color:#b94a48">ERROR: APAGANET_BASE_URL no definido.</div>'; showDebug('APAGANET_BASE_URL indefinida'); return; }
      const agentId = (el('agentIdForScan') && el('agentIdForScan').value) || '1';
      const adminToken = localStorage.getItem('apaganet.admin_token') || '';
      el('compatResult').innerHTML = 'Buscando reportes...';

      const modem = await safeFetch(`/agents/modem-compat/latest?agent_id=${encodeURIComponent(agentId)}`, adminToken);
      showDebug(`/agents/modem-compat returned status=${modem.status||'ERR'}`);

      const devices = await safeFetch(`/agents/devices/latest?agent_id=${encodeURIComponent(agentId)}`, adminToken);
      showDebug(`/agents/devices returned status=${devices.status||'ERR'}`);

      if (!modem.ok) {
        el('compatResult').innerHTML = `<div style="color:#b94a48">Error modem: ${modem.status||modem.error} <pre>${JSON.stringify(modem.body||modem.error)}</pre></div>`;
        return;
      }
      if (!devices.ok) {
        el('compatResult').innerHTML = `<div style="color:#b94a48">Error devices: ${devices.status||devices.error} <pre>${JSON.stringify(devices.body||devices.error)}</pre></div>`;
        return;
      }

      const m = modem.body && modem.body.report ? modem.body.report : modem.body;
      if (!m) { el('compatResult').innerHTML = '<div style="color:#b94a48">No hay reporte de módem</div>'; return; }
      const comp = (m.decision && m.decision.compatibility || 'none').toLowerCase();
      if (comp === 'compatible') {
        const dlist = (devices.body && devices.body.report && devices.body.report.devices) || (devices.body && devices.body.devices) || [];
        const devicesHtml = dlist.length ? `<ul>${dlist.map(d=>`<li>${d.hostname||d.ip} — ${d.mac||'sin MAC'}</li>`).join('')}</ul>` : '<p>No se detectaron equipos</p>';
        el('compatResult').innerHTML = `<div style="border:1px solid #28a745;padding:12px;border-radius:8px;background:#ecf9f1"><h3>¡Felicidades! ✅</h3><p>Tu módem parece ser <strong>compatible</strong>.</p>${devicesHtml}<p><small>Razón: ${m.decision?.reason||''}</small></p></div>`;
      } else if (comp === 'partial') {
        el('compatResult').innerHTML = `<div style="border:1px solid #f0ad4e;padding:12px;border-radius:8px;background:#fff8e6"><h3>Parcialmente compatible ⚠️</h3><p>Puede requerir pasos adicionales.</p><p><small>Razón: ${m.decision?.reason||''}</small></p></div>`;
      } else {
        el('compatResult').innerHTML = `<div style="border:1px solid #d9534f;padding:12px;border-radius:8px;background:#fff6f6"><h3>No compatible ❌</h3><pre>${JSON.stringify(m.decision||m, null, 2)}</pre></div>`;
      }
    });
    showDebug('Handler bind exitoso');
    return true;
  }

  // try initial bind
  if (bindButtonOnce()) return;
  // if not present yet, observe DOM for widget insertion
  const mo = new MutationObserver((mutations, observer) => {
    if (bindButtonOnce()) {
      observer.disconnect();
    }
  });
  mo.observe(document.documentElement || document.body, { childList: true, subtree: true });
  // timeout fallback
  setTimeout(()=>{ try { mo.disconnect(); showDebug('Stopped observing DOM (timeout)'); } catch(e){} }, 60000);
})();
