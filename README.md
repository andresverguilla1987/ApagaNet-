# ApagaNet Backend (Postgres + Notifs)
Fecha: 2025-10-19 04:24

## Archivos
- `server.notify.pg.js` — servidor Node con persistencia en Postgres y notificaciones.
- `schema.sql` — crea tablas mínimas.
- `.env.sample` — variables de entorno.

## Setup
1) Crea DB y ejecuta `schema.sql`.
2) Copia `.env.sample` a `.env` y ajusta valores.
3) `npm i express cors morgan dotenv jsonwebtoken nanoid stripe node-fetch nodemailer pg`
4) `node server.notify.pg.js`

