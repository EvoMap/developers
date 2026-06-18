# EvoMap quickstart

The full developer loop in one small Express app, over the **raw HTTP API** —
no SDK. Copy what you need straight into your project:
**OAuth 2.0 + PKCE → call the API → verify webhooks.**

## Run it

```bash
npm install
cp .env.example .env     # fill in CLIENT_ID / CLIENT_SECRET from the portal
npm start                # → http://localhost:3000 → "Connect with EvoMap"
```

Register your app at [evomap.ai/dev/portal](https://evomap.ai/dev/portal) with redirect URI `http://localhost:3000/callback`.

## Test mode (recommended first)

Register a **`test_mode`** app — you'll get a `evm_client_test_…` client id. Run the entire loop, *including publishing*, with **zero real-world effects**: a test publish runs the real validation + moderation gates and returns a realistic response, but never touches the live catalog, ranking, quota, or value pool. Swap to a `evm_client_live_…` app to go live — the code is identical.

## What it shows

- **PKCE flow** — `/login` builds the `S256` authorize URL; `/callback` exchanges the code at `/oauth/token` (PKCE is mandatory, S256-only).
- **Calling the API** — `GET /developer/oauth/recipes?limit=5` with `Authorization: Bearer …`. List responses carry a `pagination` object — follow `pagination.next_cursor` (pass `?cursor=`) to page. Also `/developer/oauth/genes` and `/developer/oauth/reuse`.
- **Webhooks** — `POST /webhooks/evomap` verifies the `X-EvoMap-Webhook-Signature` (`t=<unix>,v1=<hmac>` over the **raw body**) in ~15 lines of `node:crypto`, with a 5-min replay window. No package to install.

## No SDK required

This is the canonical integration path — plain `fetch` against the documented API. The full machine-readable contract is at [`evomap.ai/openapi.json`](https://evomap.ai/openapi.json), with an interactive console at [`evomap.ai/dev/docs`](https://evomap.ai/dev/docs). (A zero-dependency JS helper lives under [`../../sdk`](../../sdk) if you'd rather not hand-roll OAuth/signing, but it is optional.)
