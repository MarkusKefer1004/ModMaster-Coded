// ModMaster AI proxy — reference implementation (zero dependencies).
//
// Holds YOUR Anthropic API key server-side so end users get AI with no key of
// their own. Deploy anywhere that runs Node (Render, Railway, Fly, a VPS, etc.),
// set the env vars below, then point the app at this server's URL in
// Settings → AI connection.
//
//   ANTHROPIC_API_KEY  (required)  your Anthropic key, e.g. sk-ant-api03-...
//   MM_APP_TOKEN       (optional)  shared secret; if set, the app must send it
//                                  as the "x-mm-token" header (keeps the proxy private)
//   PORT               (optional)  defaults to 8787
//
// Run locally:  ANTHROPIC_API_KEY=sk-ant-... node server.js
//
// This is intentionally minimal. For production you'd add: real plan/quota
// checks (see PLAN GATE below), logging, and abuse protection.

const http = require('http')
const https = require('https')

const KEY = process.env.ANTHROPIC_API_KEY || ''
const APP_TOKEN = process.env.MM_APP_TOKEN || ''
const PORT = process.env.PORT || 8787
const MAX_BODY = 2 * 1024 * 1024   // 2 MB cap

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-mm-token')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
}
function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(obj))
}

const server = http.createServer((req, res) => {
  cors(res)
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end() }

  if (req.url === '/health') {
    return json(res, 200, { ok: true, keyConfigured: !!KEY, tokenRequired: !!APP_TOKEN })
  }

  if (req.method === 'POST' && (req.url === '/api/anthropic' || req.url === '/v1/messages')) {
    if (!KEY) return json(res, 500, { error: 'server_no_key', message: 'Proxy is missing ANTHROPIC_API_KEY.' })
    if (APP_TOKEN && req.headers['x-mm-token'] !== APP_TOKEN) {
      return json(res, 401, { error: 'unauthorized', message: 'Missing or invalid app token.' })
    }

    // ── PLAN GATE ────────────────────────────────────────────────────────────
    // Hook point: check the caller's plan/quota here (e.g. look up the user by a
    // signed token, count usage) and reject Free-tier overages before forwarding.
    // Left open for now.

    let body = ''
    req.on('data', c => { body += c; if (body.length > MAX_BODY) req.destroy() })
    req.on('end', () => {
      const payload = body || '{}'
      const up = https.request({
        hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'x-api-key': KEY,
          'anthropic-version': '2023-06-01',
        },
      }, ares => {
        let out = ''
        ares.on('data', c => out += c)
        ares.on('end', () => { res.writeHead(ares.statusCode || 200, { 'Content-Type': 'application/json' }); res.end(out) })
      })
      up.on('error', err => json(res, 502, { error: 'upstream_error', message: err.message }))
      up.write(payload); up.end()
    })
    return
  }

  json(res, 404, { error: 'not_found' })
})

server.listen(PORT, () => console.log('ModMaster AI proxy listening on :' + PORT + (KEY ? '' : '  (WARNING: no ANTHROPIC_API_KEY set)')))
