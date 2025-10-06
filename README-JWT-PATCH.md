# ApagaNet — JWT Patch

Este parche agrega autenticación con **JWT**:
- `POST /auth/login` ahora devuelve `token` (Bearer).
- Rutas `/devices` y `/schedules` quedan protegidas con `Authorization: Bearer <token>`.

## Archivos incluidos
- src/lib/authz.js        (middleware requireAuth)
- src/routes/auth.js      (login con JWT)
- server.js.patch.txt     (instrucciones para usar requireAuth)
- package.json.patch.txt  (nota para agregar dependencia jsonwebtoken)

## Variables de entorno
En Render → Environment, agrega:
- `JWT_SECRET=un-secreto-largo-y-unico`

## Pasos
1) Añade `JWT_SECRET` en Render.
2) Instala dependencia:
   ```bash
   npm i jsonwebtoken
   ```
3) Copia `src/lib/authz.js` a tu repo.
4) Reemplaza tu `src/routes/auth.js` por el incluido.
5) En `server.js`:
   - Importa: `import { requireAuth } from "./src/lib/authz.js";`
   - Cambia los mounts:
     ```js
     app.use("/devices", requireAuth, devices);
     app.use("/schedules", requireAuth, schedules);
     ```
6) Commit & push. En Render: **Manual Deploy → Clear build cache & deploy**.

## Pruebas rápidas
### 1) Login (recibe token)
```bash
curl -s -X POST https://TU-APP.onrender.com/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@apaganet.app","name":"Demo"}' | jq
# copia .token
```

### 2) Listar dispositivos (con Bearer)
```bash
TOKEN="... pega aquí tu token ..."
curl -s https://TU-APP.onrender.com/devices -H "Authorization: Bearer $TOKEN" | jq
```

### 3) Crear dispositivo
```bash
curl -s -X POST https://TU-APP.onrender.com/devices \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"iPhone de Juan","mac":"AA:BB:CC:DD:EE:FF"}' | jq
```

> Nota: las rutas ahora toman `req.userId` del token, no usan `x-user-id`.
