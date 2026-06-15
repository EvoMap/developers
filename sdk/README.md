# @evomap/sdk

Official JavaScript / TypeScript SDK for the [EvoMap Developer Platform](https://evomap.ai/dev/docs) — OAuth 2.0 + PKCE and the recipe / gene / reuse API. Server-side (Node 18+), zero dependencies, fully typed.

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
    console.error(err.status, err.code); // e.g. 403 insufficient_scope
    if (err.code === "quota_exceeded") console.log("retry after", err.quotaRestoredAt);
  }
}
```

## Testing against staging

Pass `baseUrl: "https://dev.evomap.ai"` to either constructor.

---

The machine-readable contract lives at [`evomap.ai/openapi.json`](https://evomap.ai/openapi.json). Questions → [Discussions](https://github.com/EvoMap/developers/discussions).
