// EvoMap quickstart — the full developer loop over the raw HTTP API, zero SDK,
// zero deps beyond express: OAuth 2.0 + PKCE, calling the API, and verifying a
// webhook. Copy what you need straight into your app.
//
//   1. npm install
//   2. cp .env.example .env  and fill in CLIENT_ID / CLIENT_SECRET from the portal
//      (register an app with redirect URI http://localhost:3000/callback).
//      Tip: register a `test_mode` app to get a `evm_client_test_…` id and run the
//      whole loop — including publishing — with zero real-world effects.
//   3. npm start  →  open http://localhost:3000  →  "Connect with EvoMap"
//
// Teaching example: the PKCE verifier is kept in memory keyed by state. In
// production, stash it in the user's session and validate state strictly.

import express from "express";
import rateLimit from "express-rate-limit";
import crypto from "node:crypto";

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET; // omit for public/PKCE-only clients
const BASE = process.env.EVOMAP_BASE || "https://evomap.ai";
const REDIRECT_URI = "http://localhost:3000/callback";
const SCOPE = "recipe:read"; // space-separate more, e.g. "recipe:read recipe:write"

if (!CLIENT_ID) {
  console.error("Set CLIENT_ID (and CLIENT_SECRET for confidential clients) — see .env.example.");
  process.exit(1);
}
const isTest = CLIENT_ID.startsWith("evm_client_test_");
console.log(`Mode: ${isTest ? "TEST (sandbox — no real-world effects)" : "LIVE"}`);

const app = express();
// Basic rate limit on every route (good practice — copy into your own app).
app.use(rateLimit({ windowMs: 60_000, max: 60 }));
const pending = new Map(); // state -> code_verifier (demo only)
const b64url = (buf) => buf.toString("base64url");

app.get("/", (_req, res) => {
  res.type("html").send('<h1>EvoMap quickstart</h1><a href="/login">Connect with EvoMap →</a>');
});

// 1. PKCE: build the authorize URL, stash the verifier keyed by state.
app.get("/login", (_req, res) => {
  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());
  const state = b64url(crypto.randomBytes(16));
  pending.set(state, verifier);
  const url =
    `${BASE}/oauth/authorize?` +
    new URLSearchParams({
      response_type: "code",
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      scope: SCOPE,
      code_challenge: challenge,
      code_challenge_method: "S256", // S256 is mandatory; plain is rejected
      state,
    });
  res.redirect(url);
});

app.get("/callback", async (req, res) => {
  const { code, state } = req.query;
  const verifier = pending.get(state);
  if (!code || !verifier) return res.status(400).send("Missing code or unknown state.");
  pending.delete(state);

  // 2. Exchange the code for tokens (urlencoded body, per OAuth2).
  const tokenRes = await fetch(`${BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: String(code),
      client_id: CLIENT_ID,
      ...(CLIENT_SECRET ? { client_secret: CLIENT_SECRET } : {}),
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    }),
  });
  const tokens = await tokenRes.json();
  if (!tokens.access_token) return res.status(400).json(tokens);

  // 3. Call the API on the user's behalf. Lists carry a `pagination` object —
  //    follow pagination.next_cursor (pass ?cursor=) to page.
  const apiRes = await fetch(`${BASE}/developer/oauth/recipes?limit=5`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const recipes = await apiRes.json();

  res.json({
    tokens: { ...tokens, access_token: "***", refresh_token: tokens.refresh_token ? "***" : undefined },
    recipes,
  });
});

// 4. Receive webhooks. Register the endpoint via the portal/API, copy the whsec_…
//    into EVOMAP_WEBHOOK_SECRET, and ALWAYS verify against the RAW body.
app.post("/webhooks/evomap", express.raw({ type: "application/json" }), (req, res) => {
  if (!verifyWebhook(req.body, req.get("X-EvoMap-Webhook-Signature"), process.env.EVOMAP_WEBHOOK_SECRET)) {
    return res.status(400).send("bad signature");
  }
  const event = JSON.parse(req.body.toString("utf8"));
  // Keep externally-controlled fields OUT of the format-string position.
  console.log("webhook received:", { type: event.type, livemode: event.livemode, data: event.data });
  res.sendStatus(200);
});

// Verify the `t=<unix>,v1=<hmac>` signature: HMAC-SHA256 over `${t}.${rawBody}`,
// constant-time compared, rejecting events older than 5 min (replay guard).
// ~15 lines — no SDK needed.
function verifyWebhook(rawBody, header, secret, toleranceSec = 300) {
  if (!secret || !header) return false;
  const parts = Object.fromEntries(String(header).split(",").map((p) => {
    const i = p.indexOf("=");
    return i > 0 ? [p.slice(0, i).trim(), p.slice(i + 1).trim()] : [p, ""];
  }));
  if (!parts.t || !parts.v1) return false;
  const body = Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody);
  const expected = crypto.createHmac("sha256", secret).update(`${parts.t}.${body}`).digest("hex");
  const a = Buffer.from(parts.v1, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  return Math.floor(Date.now() / 1000) - Number(parts.t) <= toleranceSec;
}

app.listen(3000, () => console.log("Listening on http://localhost:3000"));
