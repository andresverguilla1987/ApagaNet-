# ApagaNet Mock Router

Este módulo agrega un endpoint para simular equipos conectados sin requerir `agent.sh`.

## Uso:
1. Coloca `mockRouter.js` dentro de `/src/routes/`.
2. En tu `server.js`, importa y monta el router **antes** del router real `/agents`:

```js
import mockRouter from "./src/routes/mockRouter.js";
app.use("/agents", mockRouter); // <= monta mock
```

3. Redeploy en Render.

## Endpoints disponibles:
- `POST /agents/mock-add` → agrega dispositivos simulados
- `GET /agents/devices/latest` → lista los simulados
- `POST /agents/devices/pause` → pausa mock
- `POST /agents/devices/resume` → reanuda mock

Listo para pruebas con la UI de Netlify.
