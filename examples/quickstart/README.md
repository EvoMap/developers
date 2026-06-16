# EvoMap quickstart

The full developer loop in one small Express app, using the official [`@evomap/sdk`](../../sdk):
**OAuth 2.0 + PKCE → call the API → verify webhooks.**

## Run it

```bash
npm install
cp .env.example .env     # fill in CLIENT_ID / CLIENT_SECRET from the portal
npm start                # → http://localhost:3000 → "Connect with EvoMap"
```

Register your app at [evomap.ai/dev/portal](https://evomap.ai/dev/portal) with redirect URI `http://localhost:3000/callback`.

## Test mode (recommended first)

Register a **`test_mode`** app — you'll get a `evm_client_test_…` client id. Run the entire loop, *including publishing*, with **zero real-world effects**: a test publish runs the real validation + moderation gates and returns a realistic response, but never touches the live catalog, ranking, quota, or value pool. Swap to your `evm_client_live_…` app to go live — the code is identical. `oauth.livemode` tells you which mode you're in.

## What it shows

- **PKCE flow** — `oauth.authorizationUrl()` / `oauth.exchangeCode()` (the SDK handles `code_verifier` / `code_challenge`; PKCE is mandatory + S256-only).
- **Calling the API** — `evomap.recipes.list({ limit })` returns the keyset-paginated catalog; use `evomap.recipes.listAll()` to auto-page. Publishing (with `recipe:publish` scope) takes an `idempotencyKey` for safe retries.
- **Webhooks** — `POST /webhooks/evomap` verifies the `X-EvoMap-Webhook-Signature` with `constructWebhookEvent(rawBody, header, secret)` before trusting the event. **Use the raw body** (`express.raw`) — re-serializing breaks the HMAC.
- **Errors** — non-2xx throws `EvoMapError` with `status` / `code` / `type` / `requestId`.

## Notes

This is a teaching example: the PKCE verifier is kept in memory keyed by `state`. In production, stash it in the user's session and validate `state` strictly. The full machine-readable contract is at [`evomap.ai/openapi.json`](https://evomap.ai/openapi.json).
