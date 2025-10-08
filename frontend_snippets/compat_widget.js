// compat_widget.js - frontend behavior to call modem/device endpoints and show user-friendly messages
(async function(){
  function baseUrl(){ return window.APAGANET_BASE_URL || (process.env && (process.env.REACT_APP_APAGANET_BASE_URL||process.env.VITE_APAGANET_BASE_URL)) || ''; }
  const BASE = baseUrl() || '';
  // admin token in localStorage for testing; in production use proper auth flow
  const adminToken = localStorage.getItem('apaganet.admin_token') || '';

  function el(id){ return document.getElementById(id); }
  el('btnCheckCompatibility').addEventListener('click', async ()=>{
    el('compatResult').innerHTML = 'Buscando reportes...';
    // ask backend for latest modem compat report and device report for default agent id (ask user for agent id if needed)
    const agentId = document.getElementById('agentIdForScan') ? document.getElementById('agentIdForScan').value : 'house-1';
    try {
      const [modemResp, deviceResp] = await Promise.all([
        fetch(`${BASE}/agents/modem-compat/latest?agent_id=${encodeURIComponent(agentId)}`, { headers: { Authorization: 'Bearer ' + adminToken } }).then(r=>r.json()),
        fetch(`${BASE}/agents/devices/latest?agent_id=${encodeURIComponent(agentId)}`, { headers: { Authorization: 'Bearer ' + adminToken } }).then(r=>r.json()),
      ]);
      const modem = modemResp.report;
      const dev = deviceResp.report;
      if (!modem) {
        el('compatResult').innerHTML = '<div style="color:#b94a48">No hay reporte de módem. Corre el agente en la LAN y vuelve a intentar.</div>';
        return;
      }
      const comp = modem.decision && modem.decision.compatibility ? modem.decision.compatibility : 'none';
      if (comp === 'compatible') {
        // show friendly message and list of devices that would be affected
        const devicesHtml = dev && dev.devices ? `<ul>${dev.devices.map(d=>`<li>${d.hostname||d.ip} — ${d.mac||'sin MAC'}</li>`).join('')}</ul>` : '<p>No se detectaron equipos</p>';
        el('compatResult').innerHTML = `<div style="border:1px solid #28a745;padding:12px;border-radius:8px;background:#ecf9f1">
          <h3>¡Felicidades! ✅</h3>
          <p>Tu módem parece ser <strong>compatible</strong> con nuestros servicios. Puedes usar ApagaNet para gestionar y bloquear dispositivos.</p>
          <p><strong>Equipos detectados en la red:</strong></p>
          ${devicesHtml}
          <p><small>Razón: ${modem.decision.reason || ''}</small></p>
        </div>`;
      } else if (comp === 'partial') {
        el('compatResult').innerHTML = `<div style="border:1px solid #f0ad4e;padding:12px;border-radius:8px;background:#fff8e6">
          <h3>Parcialmente compatible ⚠️</h3>
          <p>Detectamos interfaces de administración: puede requerir pasos adicionales.</p>
          <p><small>Razón: ${modem.decision.reason || ''}</small></p>
        </div>`;
      } else {
        el('compatResult').innerHTML = `<div style="border:1px solid #d9534f;padding:12px;border-radius:8px;background:#fff6f6">
          <h3>No compatible ❌</h3>
          <p>No encontramos interfaces programables en tu módem. Puedes instalar el agente local o seguir la guía.</p>
        </div>`;
      }
    } catch(e) {
      el('compatResult').innerHTML = '<div style="color:#b94a48">Error al consultar el backend: '+e.message+'</div>';
    }
  });
})();