/*
  src/routes/blocks_extra.js
  Additional endpoints:
    POST /agents/report-devices         <- agent sends discovered LAN devices
    GET  /agents/devices/latest         <- get latest device report by agent_id
  Works with existing blocks.js. Export default function.
*/

export default function blocksExtraRoutes(app, ctx = {}) {
  const db = ctx.db;
  const authenticateAgent = ctx.authenticateAgent || ((req,res,next)=>next());
  const authenticateAdmin = ctx.authenticateAdmin || ((req,res,next)=>next());

  // Agent posts a device discovery report
  app.post('/agents/report-devices', authenticateAgent, async (req, res) => {
    try {
      const { agent_id, devices, timestamp } = req.body || {};
      if (!devices || !Array.isArray(devices) || devices.length === 0) {
        return res.status(400).json({ ok:false, message: 'no devices' });
      }
      const q = `INSERT INTO agent_device_reports(agent_id, devices, ts, created_at)
                 VALUES ($1,$2,$3,now()) RETURNING id`;
      const params = [
        agent_id || (req.agent && req.agent.id) || null,
        JSON.stringify(devices),
        timestamp || new Date().toISOString()
      ];
      const r = await db.query(q, params);
      return res.json({ ok:true, id: r.rows[0].id, count: devices.length });
    } catch (e) {
      console.error('report-devices err', e);
      return res.status(500).json({ ok:false, message:'db error' });
    }
  });

  // Get latest device report for an agent
  app.get('/agents/devices/latest', async (req, res) => {
    try {
      const agentId = req.query.agent_id || (req.agent && req.agent.id) || null;
      if (!agentId) return res.status(400).json({ ok:false, message: 'agent_id required' });
      const q = `SELECT id, agent_id, devices, ts, created_at FROM agent_device_reports WHERE agent_id=$1 ORDER BY created_at DESC LIMIT 1`;
      const r = await db.query(q, [agentId]);
      if (r.rowCount === 0) return res.json({ ok:true, report: null });
      // parse devices JSON
      const row = r.rows[0];
      return res.json({ ok:true, report: { id: row.id, agent_id: row.agent_id, devices: row.devices, ts: row.ts, created_at: row.created_at } });
    } catch (e) {
      console.error('agents/devices/latest err', e);
      return res.status(500).json({ ok:false });
    }
  });

  // Admin: list recent device reports (optional)
  app.get('/admin/agent-device-reports', authenticateAdmin, async (req, res) => {
    try {
      const limit = Math.min(100, Number(req.query.limit || 20));
      const q = `SELECT id, agent_id, jsonb_array_length(devices) as device_count, ts, created_at
                 FROM agent_device_reports ORDER BY created_at DESC LIMIT $1`;
      const r = await db.query(q, [limit]);
      return res.json({ ok:true, reports: r.rows });
    } catch (e) {
      console.error('admin/agent-device-reports err', e);
      return res.status(500).json({ ok:false });
    }
  });

} // end export default
