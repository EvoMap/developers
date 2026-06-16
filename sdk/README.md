# @evomap/sdk

Official JavaScript / TypeScript SDK for the [EvoMap Developer Platform](https://evomap.ai/dev/docs) — OAuth 2.0 + PKCE, the recipe / gene / reuse API (cursor pagination + idempotency keys), an isolated test mode, and webhook signature verification. Server-side (Node 18+), zero dependencies, fully typed.

```bash
npm install @evomap/sdk
```

## OAuth 2.0 (Authorization Code + PKCE)

```js
import { OAuthClient } from "@evomap/sdk";

const oauth = new OAuthClient({
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET, // omit for public/PKCE-only clients
  redirectUri: "https://yourapp.com/callback",
});

// 1. Send the user to consent. Stash codeVerifier + state (keyed by state).
const { url, codeVerifier, state } = oauth.authorizationUrl({ scope: ["recipe:read"] });
// res.redirect(url)

// 2. On the callback, exchange the code (with the stashed verifier).
const tokens = await oauth.exchangeCode({ code, codeVerifier });
// tokens: { accessToken, refreshToken, expiresIn, scope }

// Later: refresh (refresh tokens rotate — store the new one) or revoke.
const next = await oauth.refresh(tokens.refreshToken);
await oauth.revoke(tokens.accessToken);
```

PKCE is mandatory and **S256-only** — the SDK handles the `code_verifier` / `code_challenge` for you.

## Calling the API

```js
import { EvoMap } from "@evomap/sdk";

const evomap = new EvoMap({ accessToken: tokens.accessToken });

const { recipes } = await evomap.recipes.list({ q: "deploy", limit: 10 }); // recipe:read
const { genes } = await evomap.genes.list({ type: "strategy", limit: 10 }); // gene:read
const reuse = await evomap.reuse.query({ recipeId: "rec_123" });            // reuse:query

const draft = await evomap.recipes.create({ title: "My recipe", /* ... */ });   // recipe:write
const published = await evomap.recipes.publish({ title: "My recipe", /* ... */ }); // recipe:publish
```

### Pagination

List responses carry a uniform `pagination` object. The promoted recipe catalog is keyset-paginated — follow `pagination.next_cursor`, or let `listAll` do it:

```js
const { recipes, pagination } = await evomap.recipes.list({ limit: 50 });
if (pagination.has_more) {
  const next = await evomap.recipes.list({ limit: 50, cursor: pagination.next_cursor });
}

// Or auto-paginate:
for await (const recipe of evomap.recipes.listAll({ limit: 100 })) {
  console.log(recipe.id);
}
```

### Idempotency

Pass an `idempotencyKey` on publish so a retried request (e.g. after a network blip) replays the original result instead of creating a duplicate:

```js
await evomap.recipes.publish(recipe, { idempotencyKey: "order_42_publish" });
```

## Scopes

`gene:read` · `recipe:read` · `reuse:query` are self-serve. `recipe:write` (draft) is self-serve; `recipe:publish` needs an approved developer application (see the [portal](https://evomap.ai/dev/portal)).

## Errors

Every non-2xx response throws `EvoMapError`:

```js
import { EvoMapError } from "@evomap/sdk";

try {
  await evomap.recipes.publish({ /* ... */ });
} catch (err) {
  if (err instanceof EvoMapError) {
    console.error(err.status, err.code, err.type); // e.g. 403 insufficient_scope auth_error
    console.error("request id:", err.requestId);   // quote this in support requests
    if (err.code === "quota_exceeded") console.log("quota resets at", err.quotaRestoredAt);
    if (err.status === 429) console.log("retry after", err.retryAfter, "s", err.rateLimit);
  }
}
```

## Test mode

Test vs live is welded to the **credential**, Stripe-style: register a `test_mode` client and you get a `evm_client_test_…` client id (vs `evm_client_live_…`). The SDK code is identical — just use the token minted from your test client. A test publish runs the real validation + moderation gates and returns a realistic response, but is **fully isolated**: it never touches the live catalog, ranking, quota, or value pool, and is readable back only with a test token. `oauth.livemode` and the response `livemode` field tell you which mode you're in.

```js
const oauth = new OAuthClient({ clientId: "evm_client_test_…", redirectUri });
oauth.livemode; // false
```

## Webhooks

Verify incoming webhook deliveries before trusting them. **Use the raw request body** — re-serializing the JSON breaks the HMAC.

```js
import express from "express";
import { constructWebhookEvent, WebhookSignatureError } from "@evomap/sdk";

app.post("/webhooks/evomap", express.raw({ type: "application/json" }), (req, res) => {
  let event;
  try {
    event = constructWebhookEvent(
      req.body,                                   // Buffer (raw bytes)
      req.get("X-EvoMap-Webhook-Signature"),
      process.env.EVOMAP_WEBHOOK_SECRET,          // the whsec_… from registration
    );
  } catch (err) {
    if (err instanceof WebhookSignatureError) return res.status(400).send(err.reason);
    throw err;
  }
  switch (event.type) {
    case "recipe.created":   /* ... */ break;
    case "recipe.published": /* ... */ break;
    case "ping":             /* sent by the "Send test event" button */ break;
  }
  res.sendStatus(200);
});
```

The signature header is `t=<unix>,v1=<hmac-sha256 of `${t}.${rawBody}`>`; `constructWebhookEvent` checks it in constant time and rejects events older than 5 minutes (replay guard — tune with `{ toleranceSec }`).

## Testing against staging

Pass `baseUrl: "https://dev.evomap.ai"` to either constructor.

---

The machine-readable contract lives at [`evomap.ai/openapi.json`](https://evomap.ai/openapi.json). Questions → [Discussions](https://github.com/EvoMap/developers/discussions).
