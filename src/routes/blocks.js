/*
  src/routes/blocks.js
  Rutas para:
    POST /agents/report-modem-compat
    GET  /agents/modem-compat/latest
    GET  /devices/preview-blocks
    POST /devices/apply-blocks

  Export: default function(app, ctx)
  ctx must provide: db (Postgres pool), authenticateAgent, authenticateAdmin, publishToAgentQueue
*/

export default function blocksRoutes(app, ctx = {}) {
  const db = ctx.db;
  const authenticateAgent = ctx.authenticateAgent || ((req,res,next)=>next());
  const authenticateAdmin = ctx.authenticateAdmin || ((req,res,next)=>next());
  const publishToAgentQueue = ctx.publishToAgentQueue || (async ()=>{});

  // Receive modem compatibility report from agent
  app.post('/agents/report-modem-compat', authenticateAgent, async (req, res) => {
    const { agent_id, gateway, nmap, http, ssdp, decision, timestamp } = req.body || {};
    try {
      const q = `INSERT INTO agent_modem_reports(agent_id,gateway,nmap,http,ssdp,decision,ts,created_at)
                 VALUES($1,$2,$3,$4,$5,$6,$7,now()) RETURNING id`;
      const params = [
        agent_id || (req.agent && req.agent.id) || null,
        gateway || null,
        nmap ? JSON.stringify(nmap) : null,
        http ? JSON.stringify(http) : JSON.stringify([]),
        ssdp ? JSON.stringify(ssdp) : JSON.stringify([]),
        decision ? JSON.stringify(decision) : JSON.stringify({}),
        timestamp || new Date().toISOString()
      ];
      const result = await db.query(q, params);
      return res.json({ ok: true, id: result.rows[0].id });
    } catch (err) {
      console.error('report-modem-compat err', err);
      return res.status(500).json({ ok:false, message:'db error' });
    }
  });

  // Get latest report for an agent (admin or agent itself)
  app.get('/agents/modem-compat/latest', async (req, res) => {
    try {
      const agentId = req.query.agent_id || (req.agent && req.agent.id) || null;
      if (!agentId) return res.status(400).json({ ok:false, message: 'agent_id required' });
      const q = `SELECT id, agent_id, gateway, http, ssdp, decision, ts, created_at
                 FROM agent_modem_reports WHERE agent_id=$1 ORDER BY created_at DESC LIMIT 1`;
      const r = await db.query(q, [agentId]);
      if (r.rowCount === 0) return res.json({ ok:true, report: null });
      return res.json({ ok:true, report: r.rows[0] });
    } catch (err) {
      console.error('modem-compat.latest err', err);
      return res.status(500).json({ ok:false });
    }
  });

  // Preview devices that would be blocked (manual + schedules)
  app.get('/devices/preview-blocks', authenticateAdmin, async (req, res) => {
    try {
      const manualQ = `SELECT id::text, name, mac, last_seen_ip, last_seen_at, owner_email, blocked
                       FROM devices WHERE blocked = true`;
      const manual = (await db.query(manualQ)).rows || [];

      let scheduled = [];
      if (req.query.include_schedules === 'true') {
        const schedQ = `
          SELECT d.id::text, d.name, d.mac, d.last_seen_ip, d.last_seen_at, d.owner_email, 'schedule' as reason
          FROM schedules s
          JOIN devices d ON d.id = s.device_id
          WHERE ( /* REPLACE with real "active now" condition */ true )
          LIMIT 500`;
        try { scheduled = (await db.query(schedQ)).rows || []; } catch(e) { scheduled = []; }
      }

      const map = new Map();
      for (const r of scheduled) map.set(r.id, {...r, reason: 'schedule'});
      for (const r of manual) map.set(r.id, {...r, reason: 'manual'});

      const list = Array.from(map.values()).map(d => ({
        id: d.id, name: d.name, mac: d.mac, ip: d.last_seen_ip,
        last_seen_at: d.last_seen_at, owner: d.owner_email, reason: d.reason
      }));

      list.sort((a,b) => {
        const ta = a.last_seen_at ? new Date(a.last_seen_at).getTime() : 0;
        const tb = b.last_seen_at ? new Date(b.last_seen_at).getTime() : 0;
        return tb - ta;
      });

      return res.json({ ok:true, count: list.length, devices: list });
    } catch (err) {
      console.error('preview-blocks err', err);
      return res.status(500).json({ ok:false });
    }
  });

  // Apply block action (dry-run supported). Notifies agents via publishToAgentQueue for real run.
  app.post('/devices/apply-blocks', authenticateAdmin, async (req, res) => {
    try {
      const { device_ids = [], exclude_ids = [], agent_id = null, dry_run = false, reason = 'manual' } = req.body || {};
      const finalIds = (device_ids || []).filter(id => !(exclude_ids || []).includes(id));
      if (!finalIds.length) return res.status(400).json({ ok:false, message:'no devices selected' });

      const q = `SELECT id::text, mac FROM devices WHERE id = ANY($1::text[])`;
      const r = await db.query(q, [finalIds]);
      const macs = r.rows.map(x => x.mac).filter(Boolean);

      // Log action
      await db.query(`INSERT INTO device_block_actions(actor_id, agent_id, device_ids, macs, dry_run, reason)
                      VALUES ($1,$2,$3,$4,$5,$6)`, [
        req.user && req.user.id || null, agent_id, finalIds, macs, dry_run, reason
      ]);

      if (!dry_run && macs.length) {
        // notify agent(s) to apply blocks
        const payload = { type: 'apply_macs', agent_id, macs, action: 'block', reason };
        try { await publishToAgentQueue(payload); } catch(e) { console.warn('publishToAgentQueue failed', e && e.message); }

        // write history
        try {
          const histQ = `INSERT INTO device_block_history (device_id, mac, action, source, actor_id)
                         SELECT id::uuid, mac, 'block', $1, $2 FROM devices WHERE id = ANY($3::text[])`;
          await db.query(histQ, [reason, req.user && req.user.id || null, finalIds]);
        } catch(e) { console.warn('history insert failed', e && e.message); }
      }

      return res.json({ ok:true, macs, count: macs.length, dry_run });
    } catch (err) {
      console.error('apply-blocks err', err);
      return res.status(500).json({ ok:false, message: 'server error' });
    }
  });

} // end export default
