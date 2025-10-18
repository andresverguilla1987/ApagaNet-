# ApagaNet — Demo Backend (Investor Option A)

Minimal Express API with in-memory state to demo the flow:
**agent → device report → admin pauses device → alert appears**.

## Endpoints
- `POST /auth/demo-token` → returns `{ token, homeId }` (use for admin requests)
- `GET /api/health` or `/api/ping` → health check
- `POST /agents/report` (header `x-task-secret`) → report devices/modem
- `GET /agents/next-actions` (header `x-task-secret`) → poll actions for router/agent
- `GET /devices` (Bearer token) → list devices
- `POST /control/pause` (Bearer token) → queue PAUSE action + create alert
- `GET /alerts` (Bearer token) → list alerts
- `PATCH /alerts/:id/read` (Bearer token) → mark alert as read

## Local dev
```bash
npm install
npm run dev
```

## Render deploy
- Build Command: `npm install --no-audit --no-fund`
- Start Command: `node server.js`
- Environment:
  - `ALLOWED_ORIGINS` = your Netlify URL in JSON array (e.g., ["https://YOUR.netlify.app"])
  - `JWT_SECRET` = strong secret
  - `TASK_SECRET` = strong secret

## PowerShell smoke tests
```powershell
$API = "https://YOUR-RENDER.onrender.com"

# 1) Health
irm "$API/api/health"

# 2) Get admin token
$t = (irm -Method Post -Body (@{homeId="HOME-DEMO-1"} | ConvertTo-Json) -ContentType "application/json" "$API/auth/demo-token").token
$hdr = @{ Authorization = "Bearer $t" }

# 3) List devices (seeded)
irm -Headers $hdr "$API/devices"

# 4) Pause internet for a device
irm -Method Post -Headers $hdr -Body (@{mac="AA:BB:CC:11:22:33"; minutes=15} | ConvertTo-Json) -ContentType "application/json" "$API/control/pause"

# 5) Check alerts
irm -Headers $hdr "$API/alerts"

# 6) Agent pulls actions (simulate router)
$task = @{ "x-task-secret" = "change_me_for_agents" }
irm -Headers $task "$API/agents/next-actions?homeId=HOME-DEMO-1"
```
