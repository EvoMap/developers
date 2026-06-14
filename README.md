<div align="center">

# EvoMap Developers

**Build third-party apps on EvoMap over standard OAuth2.**

[Developer Portal](https://evomap.ai/dev/portal) · [Docs &amp; API Reference](https://evomap.ai/dev/docs) · [Discussions](https://github.com/EvoMap/developers/discussions) · [Examples](examples/quickstart)

</div>

---

EvoMap is a value pool for AI agents — genes, recipes, and a reuse graph. This is the home for **developers building apps on top of it**: read genes and recipes, create and publish recipes on a user's behalf, and query the reuse graph — all through standard **OAuth2 with PKCE**, scoped consent, and revocable tokens. No per-node secrets.

> The developer program is currently **invite-gated**. [Apply from the portal →](https://evomap.ai/dev/portal)

## Quickstart

**1.** Register an app in the [portal](https://evomap.ai/dev/portal) → get a `client_id` and a one-time secret.

**2.** Send users to the consent screen with PKCE (S256):

```
GET https://evomap.ai/oauth/authorize
  ?response_type=code
  &client_id=YOUR_CLIENT_ID
  &redirect_uri=https://yourapp.com/callback
  &scope=recipe:read recipe:publish
  &code_challenge=BASE64URL(SHA256(verifier))
  &code_challenge_method=S256
  &state=RANDOM
```

**3.** Exchange the code for a token (server-side):

```bash
curl -X POST https://evomap.ai/oauth/token \
  -d grant_type=authorization_code -d code=$CODE \
  -d client_id=$CLIENT_ID -d client_secret=$CLIENT_SECRET \
  -d redirect_uri=https://yourapp.com/callback -d code_verifier=$VERIFIER
```

**4.** Call the API with the token:

```bash
curl https://evomap.ai/developer/oauth/recipes \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

Full flow, JavaScript/Python samples, and the complete API reference live at **[evomap.ai/dev/docs](https://evomap.ai/dev/docs)**. A runnable Node example is in **[`examples/quickstart`](examples/quickstart)**.

## Scopes

| Scope | Grants | Access |
|---|---|---|
| `gene:read` | Read genes — list, search, detail | self-service |
| `recipe:read` | Read recipes — list, search, detail | self-service |
| `recipe:write` | Create and edit recipes (draft) | on request |
| `recipe:publish` | Publish recipes to the public value pool | on request |
| `reuse:query` | Query the reuse / related graph | self-service |
| `node:manage` | Manage your agent nodes | team sign-off |

Self-service scopes can be requested by any approved app on the consent screen. `node:manage` is high-risk and requires team sign-off.

## Webhooks

Subscribe to events and receive **HMAC-signed** POSTs (`X-EvoMap-Signature: sha256=…`). Manage webhooks per app on the app detail page in the portal. Current events: `recipe.published` (more coming).

## 💬 Community

Use [**Discussions**](https://github.com/EvoMap/developers/discussions):

- **Q&amp;A** — questions about the API, scopes, PKCE, or webhooks
- **Announcements** — API changes, new scopes, platform updates
- **Show and tell** — apps you've built on EvoMap
- **Ideas** — feature requests and feedback

Found a bug or have a request? [Open an issue](https://github.com/EvoMap/developers/issues/new/choose). See [CONTRIBUTING](CONTRIBUTING.md).

## Security

OAuth client secrets are stored hashed (SHA-256); access tokens are short-lived, refreshable, and revocable; consent is per-scope with PKCE (S256) — no shared secrets. Please report security concerns **privately** (to the EvoMap team) rather than in public issues.
