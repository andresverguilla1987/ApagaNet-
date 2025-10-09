(function(){
  const apiBase = '/api'; // Netlify should proxy /api/* to your backend
  const log = (s)=>{ const d=document.getElementById('debug'); d.textContent = (new Date().toISOString())+' | '+s+'\n'+d.textContent; };

  const elAgent = document.getElementById('agentIdForScan');
  const btn = document.getElementById('btnCheckCompatibility');
  const ping = document.getElementById('btnPing');
  const out = document.getElementById('compatResult');

  const renderReport = (r) => {
    out.innerHTML = '<pre>'+JSON.stringify(r,null,2)+'</pre>';
  };

  btn.addEventListener('click', async ()=>{
    const agent = elAgent.value || '1';
    log('Botón pulsado, agent='+agent);
    try {
      const res = await fetch(apiBase + '/agents/modem-compat/latest?agent_id='+encodeURIComponent(agent));
      const j = await res.json();
      if (!res.ok) {
        log('/api/agents/modem-compat?agent_id='+agent+' -> '+res.status+' ' + JSON.stringify(j));
        out.innerHTML = '<pre>'+JSON.stringify(j,null,2)+'</pre>';
        return;
      }
      log('Éxito en /api/agents/modem-compat/latest?agent_id='+agent);
      renderReport(j);
    } catch(e){
      log('Error fetch: '+String(e));
      out.innerHTML = '<pre>'+String(e)+'</pre>';
    }
  });

  ping.addEventListener('click', async ()=>{
    try {
      const r = await fetch(apiBase + '/ping');
      const j = await r.json();
      log('/api/ping -> '+r.status);
      out.innerHTML = '<pre>'+JSON.stringify(j,null,2)+'</pre>';
    } catch(e){
      log('ping err '+e);
    }
  });

  log('Handler enlazado al botón');
})();
