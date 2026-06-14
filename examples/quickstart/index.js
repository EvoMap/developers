// Minimal EvoMap OAuth2 + PKCE example (Express, Node 18+).
//
//   1. npm install
//   2. cp .env.example .env  and fill in CLIENT_ID / CLIENT_SECRET from the portal
//      (set your app's redirect URI to http://localhost:3000/callback)
//   3. npm start  →  open http://localhost:3000  →  "Connect with EvoMap"
//
// This is a teaching example: the PKCE verifier is kept in memory keyed by state.
// In production, store it in the user's session and validate state strictly.

import express from "express";
import crypto from "node:crypto";

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const BASE = process.env.EVOMAP_BASE || "https://evomap.ai";
const REDIRECT_URI = "http://localhost:3000/callback";
const SCOPE = "recipe:read";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Set CLIENT_ID and CLIENT_SECRET (see .env.example).");
  process.exit(1);
}

const app = express();
const pending = new Map(); // state -> code_verifier (demo only)
const b64url = (buf) => buf.toString("base64url");

app.get("/", (_req, res) => {
  res.type("html").send('<h1>EvoMap quickstart</h1><a href="/login">Connect with EvoMap →</a>');
});

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
      code_challenge_method: "S256",
      state,
    });
  res.redirect(url);
});

app.get("/callback", async (req, res) => {
  const { code, state } = req.query;
  const verifier = pending.get(state);
  if (!code || !verifier) return res.status(400).send("Missing code or unknown state.");
  pending.delete(state);

  // Exchange the authorization code for tokens.
  const tokenRes = await fetch(`${BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: String(code),
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    }),
  });
  const tokens = await tokenRes.json();
  if (!tokens.access_token) return res.status(400).json(tokens);

  // Call the API on the user's behalf.
  const apiRes = await fetch(`${BASE}/developer/oauth/recipes`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const recipes = await apiRes.json();

  res.json({
    tokens: { ...tokens, access_token: "***", refresh_token: tokens.refresh_token ? "***" : undefined },
    recipes,
  });
});

app.listen(3000, () => console.log("Listening on http://localhost:3000"));
