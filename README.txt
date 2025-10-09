# server.js parcheado (ApagaNet)

- Agrega endpoints abiertos para la UI de Netlify sin JWT:
  - `GET /agents/modem-compat`
  - `GET /agents/devices/latest` (fallback)
  - `POST /agents/devices/pause`
  - `POST /agents/devices/resume`
- Mantiene tus routers existentes (`/auth`, `/devices` con JWT, `/schedules` con JWT, `/agents`, `/admin` con TASK_SECRET).
- No rompe nada: si tu router `/agents` define `devices/latest`, prevalecerá.

Despliegue: reemplaza tu `server.js` en Render y redeploy.
