# ApagaNet Backend PRO (Locations + Geofences)
Nuevo:
- POST /locations/report {homeId, deviceId, lat, lng, accuracy?, battery?, at?}
- GET  /locations/live?deviceId=...
- GET  /locations/history?deviceId=...&since=ms&until=ms&limit=500
- Geofences: GET /geofences, POST /geofences {name,lat,lng,radiusMeters}, DELETE /geofences/:id
- Alertas automáticas: geofence_enter / geofence_exit

Mantiene:
- /devices, /alerts, /public/signup, /billing/checkout, /webhooks/stripe

Deploy en Render:
- Build: npm i --no-audit --no-fund
- Start: node server.js
- ENV ver .env.sample
