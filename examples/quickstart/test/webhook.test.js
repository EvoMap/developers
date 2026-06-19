// Tests for the webhook signature verifier — the one security-critical bit of
// the quickstart. Uses the built-in node:test runner (no extra deps):
//   npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { isDirectRun, verifyWebhook } from "../index.js";

const SECRET = "whsec_test_secret";

// Build a valid `t=<unix>,v1=<hmac>` header for a body at a given timestamp.
function sign(body, secret = SECRET, t = Math.floor(Date.now() / 1000)) {
  const v1 = crypto.createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  return { header: `t=${t},v1=${v1}`, body };
}

test("accepts a correctly signed, fresh payload", () => {
  const { header, body } = sign('{"type":"recipe.created"}');
  assert.equal(verifyWebhook(Buffer.from(body), header, SECRET), true);
});

test("rejects a tampered body", () => {
  const { header } = sign('{"type":"recipe.created"}');
  assert.equal(verifyWebhook(Buffer.from('{"type":"recipe.deleted"}'), header, SECRET), false);
});

test("rejects a wrong secret", () => {
  const { header, body } = sign('{"type":"recipe.created"}');
  assert.equal(verifyWebhook(Buffer.from(body), header, "whsec_wrong"), false);
});

test("rejects a stale timestamp (replay)", () => {
  const old = Math.floor(Date.now() / 1000) - 3600;
  const { header, body } = sign('{"type":"recipe.created"}', SECRET, old);
  assert.equal(verifyWebhook(Buffer.from(body), header, SECRET), false);
});

test("rejects a future-dated timestamp", () => {
  const future = Math.floor(Date.now() / 1000) + 3600;
  const { header, body } = sign('{"type":"recipe.created"}', SECRET, future);
  assert.equal(verifyWebhook(Buffer.from(body), header, SECRET), false);
});

test("rejects a missing or malformed header", () => {
  const body = Buffer.from('{"type":"recipe.created"}');
  assert.equal(verifyWebhook(body, undefined, SECRET), false);
  assert.equal(verifyWebhook(body, "garbage", SECRET), false);
  assert.equal(verifyWebhook(body, "t=123", SECRET), false); // no v1
});

test("rejects when the secret is absent", () => {
  const { header, body } = sign('{"type":"recipe.created"}');
  assert.equal(verifyWebhook(Buffer.from(body), header, undefined), false);
});

test("detects direct execution from URL-escaped filesystem paths", () => {
  const entry = path.join(process.cwd(), "路径 with spaces", "index.js");
  assert.equal(isDirectRun(pathToFileURL(entry).href, entry), true);
  assert.equal(isDirectRun(pathToFileURL(entry).href, undefined), false);
  assert.equal(isDirectRun(pathToFileURL(entry).href, path.join(process.cwd(), "other.js")), false);
});
