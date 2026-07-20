# ModMaster AI Proxy

A tiny, **zero-dependency** Node server that holds your Anthropic API key so
ModMaster users get AI features (Create / Update / AI edit) **without needing
their own key**. This is the backend half of Step 8.

## Why
By default the app asks each user to paste their own `sk-ant-…` key — a wall for
non-technical players. Point the app at this proxy instead and that wall is gone:
the key lives here, on your server, not on the user's PC.

## Run locally
```bash
cd server
ANTHROPIC_API_KEY=sk-ant-api03-... node server.js
# → ModMaster AI proxy listening on :8787
curl http://localhost:8787/health
```

## Deploy (Render / Railway / Fly / VPS)
1. Push this repo (the `server/` folder) to your host.
2. Set env vars: `ANTHROPIC_API_KEY` (required), optionally `MM_APP_TOKEN`.
3. Start command: `node server.js` (or `npm start`).
4. Copy the public URL, e.g. `https://modmaster-proxy.onrender.com`.

## Point the app at it
In ModMaster → **Settings → AI connection**, paste the proxy URL (and the app
token if you set `MM_APP_TOKEN`). Leave it blank to fall back to per-user keys.

## Endpoints
- `GET /health` → `{ ok, keyConfigured, tokenRequired }`
- `POST /api/anthropic` → forwards the JSON body to Anthropic `/v1/messages`
  using the server key, returns Anthropic's response unchanged.

## Security / production notes
- Set `MM_APP_TOKEN` so only your app can use the proxy.
- Add real **plan/quota checks** at the `PLAN GATE` marker in `server.js`
  (tie usage to the user's account/plan) before charging for Pro.
- Consider rate limiting and request logging.
