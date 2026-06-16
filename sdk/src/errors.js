function num(v) {
  return v == null || v === "" ? null : Number(v);
}

/**
 * Error thrown for any non-2xx EvoMap API response. `code` is the machine-
 * readable error string from the API (e.g. `invalid_token`, `insufficient_scope`,
 * `approval_required_for_scopes`, `quota_exceeded`); `status` is the HTTP status.
 * The unified error envelope also surfaces `requestId` (quote it in support
 * requests) and a coarse `type`; rate-limit / quota responses carry `retryAfter`,
 * `rateLimit`, and `quotaRestoredAt`.
 */
export class EvoMapError extends Error {
  /**
   * @param {number} status - HTTP status.
   * @param {object} [body] - Parsed JSON error body ({ error, error_description, type, request_id, ... }).
   * @param {Headers} [headers] - Response headers (for request id / rate-limit / Retry-After).
   */
  constructor(status, body = {}, headers = null) {
    const b = body && typeof body === "object" ? body : {};
    const code = b.error || "request_failed";
    const description = b.error_description;
    super(description ? `${code}: ${description}` : code);
    this.name = "EvoMapError";
    this.status = status;
    /** Stable, machine-readable error code. */
    this.code = code;
    /** Coarse error class: auth_error | invalid_request | rate_limited | conflict | not_found | server_error | service_unavailable. */
    this.type = b.type || null;
    /** Correlation id — quote it in support requests (also the X-Request-Id header). */
    this.requestId = b.request_id || headers?.get?.("x-request-id") || null;
    /** When a 429 publish-quota error, the ISO instant quota resets (else null). */
    this.quotaRestoredAt = b.restoredAt ?? headers?.get?.("x-quota-restored-at") ?? null;
    /** Seconds to wait before retrying (from the Retry-After header), if present. */
    this.retryAfter = num(headers?.get?.("retry-after"));
    /** Rate-limit snapshot from X-RateLimit-* headers, if present. */
    const limit = headers?.get?.("x-ratelimit-limit");
    this.rateLimit = limit
      ? { limit: Number(limit), remaining: num(headers.get("x-ratelimit-remaining")), reset: num(headers.get("x-ratelimit-reset")) }
      : null;
  }
}
