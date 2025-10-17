// Minimal server to test alerts router standalone.
// Use only for local tests; in production integrate into your existing server.js
require('dotenv').config();
const express = require('express');
const app = express();
app.use(express.json());

app.get('/ping', (_req, res) => res.json({ ok: true, t: Date.now() }));

app.use('/alerts', require('./routes/alerts'));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Alerts test server listening on', port));
