import crypto from "node:crypto";

const DEFAULT_TOLERANCE_SEC = 300; // reject events older than 5 min (replay guard)

/** Thrown when an incoming webhook fails signature / timestamp verification. */
export class WebhookSignatureError extends Error {
  /** @param {string} reason */
  constructor(reason) {
    super(`webhook signature verification failed: ${reason}`);
    this.name = "WebhookSignatureError";
    this.reason = reason;
  }
}

function timingSafeEqualHex(a, b) {
  let ab, bb;
  try {
    ab = Buffer.from(String(a), "hex");
    bb = Buffer.from(String(b), "hex");
  } catch {
    return false;
  }
  if (ab.length === 0 || ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

// Parse `t=<unix>,v1=<hex>` into { t, v1 }.
function parseSignatureHeader(header) {
  const out = {};
  for (const part of String(header || "").split(",")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

/**
 * Verify an incoming EvoMap webhook and return the parsed event. Throws
 * {@link WebhookSignatureError} on any mismatch — call it before trusting the
 * payload.
 *
 * Verifies the `t=<unix>,v1=<hmac>` scheme: HMAC-SHA256 over `${t}.${rawBody}`
 * keyed by the webhook signing secret, with a timestamp tolerance that rejects
 * replays. **Pass the EXACT raw request body bytes** — not a re-serialized JSON
 * object (re-serialization changes whitespace/key order and breaks the HMAC).
 *
 * @param {string|Buffer} rawBody - The raw request body from the `X-EvoMap-Webhook-Signature`-signed POST.
 * @param {string} signatureHeader - The `X-EvoMap-Webhook-Signature` header value.
 * @param {string} secret - The webhook signing secret (`whsec_…`).
 * @param {{ toleranceSec?: number }} [opts] - `toleranceSec` <= 0 disables the timestamp check.
 * @returns {{ id: string, type: string, created: string, livemode: boolean, data: object }} The verified event.
 *
 * @example
 *   // Express: use express.raw({ type: "application/json" }) so req.body is a Buffer.
 *   const event = constructWebhookEvent(req.body, req.get("X-EvoMap-Webhook-Signature"), secret);
 *   if (event.type === "recipe.published") { ... }
 */
export function constructWebhookEvent(rawBody, signatureHeader, secret, { toleranceSec = DEFAULT_TOLERANCE_SEC } = {}) {
  if (!secret) throw new WebhookSignatureError("missing_secret");
  const body = Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody ?? "");
  const { t, v1 } = parseSignatureHeader(signatureHeader);
  if (!t || !v1) throw new WebhookSignatureError("malformed_signature_header");

  const expected = crypto.createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  if (!timingSafeEqualHex(v1, expected)) throw new WebhookSignatureError("signature_mismatch");

  if (toleranceSec > 0) {
    const age = Math.floor(Date.now() / 1000) - Number(t);
    if (!Number.isFinite(age) || age > toleranceSec) throw new WebhookSignatureError("timestamp_out_of_tolerance");
  }

  try {
    return JSON.parse(body);
  } catch {
    throw new WebhookSignatureError("invalid_json_body");
  }
}
