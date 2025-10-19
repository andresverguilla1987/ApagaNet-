# ApagaNet Backend PRO — Locations & Geofences

Este paquete añade **Ubicaciones** y **Geocercas** al backend Node/Express (Render + Postgres).

## Contenido
- `routes/locations.routes.js` — Endpoints `/locations/report` y `/locations/latest`
- `routes/geofences.routes.js` — Endpoints `/geofences` (GET/POST/DELETE) y `/geofences/check`
- `migrations/002_locations.sql` — Tabla `locations`
- `migrations/003_geofences.sql` — Tabla `geofences`
- `scripts/test_locations.ps1` — Script PowerShell con pruebas rápidas

## Requisitos
- Node 18+ (Express)
- PostgreSQL (Render)
- Middleware JWT existente (ej. `authJWT`)
- Función `createAlert({ user_id, device_id, type, message })` (opcional; si no está, el código sigue funcionando)

## Integración

1) Ejecuta migraciones (p. ej. desde tu inicializador al arrancar el server):
```sql
-- 002_locations.sql y 003_geofences.sql
```

2) Monta las rutas en tu `server.js`:

```js
import { locationsRoutes } from "./routes/locations.routes.js";
import { geofencesRoutes } from "./routes/geofences.routes.js";

// Suponiendo que tienes: app, pool, authJWT, y una función opcional createAlert
// Si NO tienes createAlert, pasa un stub: (args)=>console.log('alert', args)
app.use("/locations", locationsRoutes({ pool, auth: authJWT, createAlert }));
app.use("/geofences", geofencesRoutes({ pool, auth: authJWT }));
```

3) Variables de entorno: **no se añaden nuevas**.

## Endpoints

### POST `/locations/report`
Body JSON:
```json
{ "device_id": "AA:BB:CC:11:22:33", "lat": 19.4326, "lng": -99.1332, "accuracy": 25 }
```

### GET `/locations/latest?device_id=AA:BB:CC:11:22:33`

### GET `/geofences`
### POST `/geofences`
Body JSON:
```json
{ "name": "Casa", "lat": 19.4326, "lng": -99.1332, "radius_m": 250, "active": true }
```

### DELETE `/geofences/:id`

### POST `/geofences/check`
Body JSON:
```json
{ "lat": 19.4326, "lng": -99.1332 }
```

## Notas
- El cálculo de distancia usa **Haversine** en metros.
- Al reportar ubicación, si hay geocercas activas y se excede el radio, se dispara una alerta `geofence_exit` usando `createAlert` si está disponible.
