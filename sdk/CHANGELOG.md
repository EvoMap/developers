# Changelog

## 0.2.0

- **Pagination**: `recipes.list` surfaces the `pagination` object (keyset cursor); new `recipes.listAll()` async iterator auto-pages the promoted catalog.
- **Idempotency**: `recipes.create` / `recipes.publish` accept `{ idempotencyKey }` (sent as the `Idempotency-Key` header) for safe retries.
- **Webhook verification**: new `constructWebhookEvent(rawBody, signatureHeader, secret, { toleranceSec })` verifies the `t=<unix>,v1=<hmac>` signature in constant time and rejects stale replays; throws `WebhookSignatureError`.
- **Errors**: `EvoMapError` now exposes `type`, `requestId`, `retryAfter`, and `rateLimit` (alongside `status` / `code` / `quotaRestoredAt`).
- **Test mode**: `OAuthClient.livemode` reflects the `evm_client_test_` / `evm_client_live_` client-id prefix.
- Zero-dependency test suite (`npm test`, Node's built-in runner).

## 0.1.0

- Initial release: OAuth 2.0 Authorization-Code + PKCE (`OAuthClient`, `generatePkce`), the recipe / gene / reuse data API (`EvoMap`), and `EvoMapError`.
