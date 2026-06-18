// Zero-dependency tests (Node's built-in test runner): `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  constructWebhookEvent,
  WebhookSignatureError,
  EvoMapError,
  OAuthClient,
  generatePkce,
} from "../src/index.js";

const secret = "whsec_test";
const evt = { id: "evt_1", type: "recipe.published", created: new Date().toISOString(), livemode: true, data: { recipeId: "r1" } };
const body = JSON.stringify(evt);
const sign = (b, t) => crypto.createHmac("sha256", secret).update(`${t}.${b}`).digest("hex");

test("constructWebhookEvent verifies a valid signature and returns the event", () => {
  const t = Math.floor(Date.now() / 1000);
  const event = constructWebhookEvent(body, `t=${t},v1=${sign(body, t)}`, secret);
  assert.equal(event.type, "recipe.published");
  assert.equal(event.data.recipeId, "r1");
});

test("constructWebhookEvent rejects a tampered body", () => {
  const t = Math.floor(Date.now() / 1000);
  assert.throws(
    () => constructWebhookEvent(body + "x", `t=${t},v1=${sign(body, t)}`, secret),
    (e) => e instanceof WebhookSignatureError && e.reason === "signature_mismatch",
  );
});

test("constructWebhookEvent rejects a stale timestamp, but accepts it with toleranceSec:0", () => {
  const oldT = Math.floor(Date.now() / 1000) - 1000;
  const header = `t=${oldT},v1=${sign(body, oldT)}`;
  assert.throws(() => constructWebhookEvent(body, header, secret), (e) => e.reason === "timestamp_out_of_tolerance");
  assert.equal(constructWebhookEvent(body, header, secret, { toleranceSec: 0 }).id, "evt_1");
});

test("constructWebhookEvent rejects a FUTURE-dated timestamp (absolute skew, not just stale)", () => {
  const futureT = Math.floor(Date.now() / 1000) + 86400; // +24h
  const header = `t=${futureT},v1=${sign(body, futureT)}`;
  assert.throws(() => constructWebhookEvent(body, header, secret), (e) => e.reason === "timestamp_out_of_tolerance");
});

test("constructWebhookEvent rejects a malformed header / missing secret", () => {
  const t = Math.floor(Date.now() / 1000);
  assert.throws(() => constructWebhookEvent(body, "garbage", secret), (e) => e.reason === "malformed_signature_header");
  assert.throws(() => constructWebhookEvent(body, `t=${t},v1=${sign(body, t)}`, ""), (e) => e.reason === "missing_secret");
});

test("EvoMapError surfaces code/type/requestId + rate-limit headers", () => {
  const headers = new Headers({
    "x-request-id": "req_hdr", "retry-after": "30",
    "x-ratelimit-limit": "120", "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1781600000",
  });
  const err = new EvoMapError(429, { error: "rate_limited", type: "rate_limited", request_id: "req_body" }, headers);
  assert.equal(err.code, "rate_limited");
  assert.equal(err.type, "rate_limited");
  assert.equal(err.requestId, "req_body"); // body wins over header
  assert.equal(err.retryAfter, 30);
  assert.deepEqual(err.rateLimit, { limit: 120, remaining: 0, reset: 1781600000 });
});

test("OAuthClient.livemode reflects the client_id prefix", () => {
  assert.equal(new OAuthClient({ clientId: "evm_client_test_a", redirectUri: "https://x/cb" }).livemode, false);
  assert.equal(new OAuthClient({ clientId: "evm_client_live_a", redirectUri: "https://x/cb" }).livemode, true);
  assert.equal(new OAuthClient({ clientId: "evm_client_legacy", redirectUri: "https://x/cb" }).livemode, true);
});

test("generatePkce returns an S256 verifier/challenge pair", () => {
  const { codeVerifier, codeChallenge } = generatePkce();
  assert.ok(codeVerifier && codeChallenge);
  assert.notEqual(codeVerifier, codeChallenge);
  const expected = crypto.createHash("sha256").update(codeVerifier).digest("base64url");
  assert.equal(codeChallenge, expected);
});
