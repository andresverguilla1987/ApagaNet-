// server-snippets/patch-endpoints.js — copy/paste into your server.js

// ---- DEBUG (optional) ----
app.get("/debug/devices", async (_req, res) => {
  const r = await pool.query("select id, name, mac, blocked, updated_at from devices order by updated_at desc limit 50");
  res.json({ ok:true, devices: r.rows });
});

app.get("/debug/actions", async (_req, res) => {
  const r = await pool.query("select * from actions order by created_at desc limit 50");
  res.json({ ok:true, actions: r.rows });
});

// ---- AGENT AUTH ----
async function requireAgent(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.sendStatus(401);
  const q = await pool.query("select id, home_id from agents where api_token=$1", [token]);
  if (!q.rowCount) return res.sendStatus(401);
  req.agent = q.rows[0];
  next();
}

app.get("/agents/next-actions", requireAgent, async (req, res) => {
  const homeId = req.query.homeId || req.agent.home_id;
  const r = await pool.query(
    "select id, mac, type from actions where home_id=$1 and status='pending' order by created_at asc limit 10",
    [homeId]
  );
  res.json({ ok: true, actions: r.rows });
});

app.post("/agents/report", requireAgent, async (req, res) => {
  const { actionId, ok, error } = req.body || {};
  if (!actionId) return res.status(400).json({ ok:false, error:"actionId required" });
  await pool.query(
    "update actions set status=$1, error=$2, processed_at=now() where id=$3",
    [ok ? "done" : "failed", error || null, actionId]
  );
  res.json({ ok: true });
});
