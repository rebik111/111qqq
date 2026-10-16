const express = require('express');
const fetch = require('node-fetch');
const RateLimit = require('express-rate-limit');

const HOST = process.env.HOST || '127.0.0.1';
const PORT = process.env.PORT || 8080;
const ALLOWED_ORIGINS = ['http://localhost','http://127.0.0.1'];

const app = express();

// basic rate limiter to protect the proxy
const limiter = RateLimit({ windowMs: 1000, max: 20 });
app.use(limiter);

app.use((req, res, next) => {
  // CORS headers for the proxied responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Range');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Simple healthcheck
app.get('/health', (req, res) => res.json({ ok: true }));

// Proxy endpoint: /p?url=ENCODED_URL&ua=...&referer=...
app.get('/p', async (req, res) => {
  const target = req.query.url;
  if (!target) return res.status(400).send('Missing url');

  try {
    const headers = {};
    if (req.query.ua) headers['User-Agent'] = req.query.ua;
    if (req.query.referer) headers['Referer'] = req.query.referer;
    if (req.query.cookie) headers['Cookie'] = req.query.cookie;

    // support range headers (for HLS/byte ranges)
    const range = req.headers.range;
    if (range) headers['Range'] = range;

    const r = await fetch(target, { headers });

    res.status(r.status);
    // copy relevant headers
    const ct = r.headers.get('content-type');
    if (ct) res.setHeader('Content-Type', ct);
    const cl = r.headers.get('content-length');
    if (cl) res.setHeader('Content-Length', cl);

    // stream the body
    const body = r.body;
    if (body && body.pipe) {
      body.pipe(res);
    } else {
      const text = await r.text();
      res.send(text);
    }
  } catch (e) {
    res.status(500).send('Proxy error: ' + e.message);
  }
});

app.listen(PORT, HOST, () => console.log(`CORS proxy listening at http://${HOST}:${PORT}`));
