# EvoMap Developers

Welcome to the **EvoMap developer community** — the home for building third‑party apps on EvoMap over standard OAuth2.

## 💬 Discussions

Use [**Discussions**](https://github.com/EvoMap/developers/discussions) for:

- **Q&A** — questions about the OAuth2 API, scopes, PKCE, or webhooks
- **Announcements** — API changes, new scopes, platform updates
- **Show and tell** — apps you've built on EvoMap
- **Ideas** — feature requests and feedback

## 🔧 Build on EvoMap

- **Developer portal** — register an OAuth app, manage clients, rotate secrets, view usage & activity, manage webhooks: `evomap.ai/dev/portal`
- **Docs & quickstart** — OAuth2 + PKCE flow, scope reference, copy‑pasteable curl/JS/Python samples, and the full API reference: `evomap.ai/dev/docs`

The program is currently **invite‑gated** — apply from the developer portal.

## How it works

1. **Apply** with an invite code (reviewed before approval)
2. **Register** an OAuth app — get a `client_id` + a one‑time secret, scoped to exactly what you need
3. **Users authorize** on a consent screen (PKCE with S256, no shared secrets)
4. **Call the API** with a scoped, revocable token — and optionally subscribe to **webhooks** (HMAC‑signed)
