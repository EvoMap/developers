// EvoMap quickstart — the full developer loop with the official @evomap/sdk:
// OAuth 2.0 + PKCE, calling the API, and verifying webhooks. (Express, Node 18+.)
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
import { OAuthClient, EvoMap, EvoMapError, constructWebhookEvent, WebhookSignatureError } from "@evomap/sdk";

const BASE = process.env.EVOMAP_BASE || "https://evomap.ai";
const REDIRECT_URI = "http://localhost:3000/callback";
const SCOPE = ["recipe:read"]; // add recipe:write / recipe:publish to create/publish

const oauth = new OAuthClient({
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET, // omit for public/PKCE-only clients
  redirectUri: REDIRECT_URI,
  baseUrl: BASE,
});
if (!process.env.CLIENT_ID) {
  console.error("Set CLIENT_ID (and CLIENT_SECRET for confidential clients) — see .env.example.");
  process.exit(1);
}
console.log(`Mode: ${oauth.livemode ? "LIVE" : "TEST (sandbox — no real-world effects)"}`);

const app = express();
const pending = new Map(); // state -> codeVerifier (demo only)

app.get("/", (_req, res) => {
  res.type("html").send('<h1>EvoMap quickstart</h1><a href="/login">Connect with EvoMap →</a>');
});

// 1. Send the user to consent. Stash the PKCE verifier keyed by state.
app.get("/login", (_req, res) => {
  const { url, codeVerifier, state } = oauth.authorizationUrl({ scope: SCOPE });
  pending.set(state, codeVerifier);
  res.redirect(url);
});

// 2. Exchange the code, then 3. call the API on the user's behalf.
app.get("/callback", async (req, res) => {
  const { code, state } = req.query;
  const codeVerifier = pending.get(state);
  if (!code || !codeVerifier) return res.status(400).send("Missing code or unknown state.");
  pending.delete(state);

  try {
    const tokens = await oauth.exchangeCode({ code: String(code), codeVerifier });
    const evomap = new EvoMap({ accessToken: tokens.accessToken, baseUrl: BASE });

    // List the promoted recipe catalog (keyset-paginated — the SDK can auto-page).
    const { recipes, pagination } = await evomap.recipes.list({ limit: 5 });

    res.json({
      livemode: oauth.livemode,
      scope: tokens.scope,
      recipes,
      pagination,
      // To publish (needs recipe:publish scope), idempotency-keyed for safe retries:
      //   await evomap.recipes.publish({ title, steps }, { idempotencyKey: "..." });
    });
  } catch (err) {
    if (err instanceof EvoMapError) {
      return res.status(err.status).json({ error: err.code, type: err.type, request_id: err.requestId });
    }
    throw err;
  }
});

// 4. Receive webhooks. Register the endpoint via the portal/API and copy the
//    whsec_… into EVOMAP_WEBHOOK_SECRET. ALWAYS verify with the raw body.
app.post("/webhooks/evomap", express.raw({ type: "application/json" }), (req, res) => {
  let event;
  try {
    event = constructWebhookEvent(
      req.body, // Buffer — the exact raw bytes
      req.get("X-EvoMap-Webhook-Signature"),
      process.env.EVOMAP_WEBHOOK_SECRET,
    );
  } catch (err) {
    if (err instanceof WebhookSignatureError) return res.status(400).send(err.reason);
    throw err;
  }
  console.log(`webhook: ${event.type} (livemode=${event.livemode})`, event.data);
  res.sendStatus(200);
});

app.listen(3000, () => console.log("Listening on http://localhost:3000"));
