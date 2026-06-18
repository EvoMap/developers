import crypto from "node:crypto";
import { EvoMapError } from "./errors.js";

const DEFAULT_BASE = "https://evomap.ai";
const b64url = (buf) => buf.toString("base64url");

/**
 * Generate a PKCE `code_verifier` and its S256 `code_challenge`. EvoMap is
 * S256-only — plain is rejected.
 * @returns {{ codeVerifier: string, codeChallenge: string }}
 */
export function generatePkce() {
  const codeVerifier = b64url(crypto.randomBytes(32));
  const codeChallenge = b64url(crypto.createHash("sha256").update(codeVerifier).digest());
  return { codeVerifier, codeChallenge };
}

/**
 * OAuth 2.0 Authorization-Code + PKCE helper for server-side apps. Drives the
 * three legs of the flow: build the authorize URL, exchange the code for tokens,
 * and refresh / revoke.
 */
export class OAuthClient {
  /**
   * @param {object} opts
   * @param {string} opts.clientId
   * @param {string} [opts.clientSecret] - confidential clients only
   * @param {string} opts.redirectUri
   * @param {string} [opts.baseUrl] - defaults to https://evomap.ai
   */
  constructor({ clientId, clientSecret, redirectUri, baseUrl = DEFAULT_BASE } = {}) {
    if (!clientId) throw new Error("clientId is required");
    if (!redirectUri) throw new Error("redirectUri is required");
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  /**
   * Whether this client operates in live mode. Test vs live is welded to the
   * credential: a `evm_client_test_…` client id is test mode (its publishes hit
   * an isolated ephemeral sandbox, never the real value pool).
   * @returns {boolean}
   */
  get livemode() {
    return !String(this.clientId).startsWith("evm_client_test_");
  }

  /**
   * Build the URL to send the user to, plus the PKCE `codeVerifier` and `state`
   * you must stash (keyed by `state`) until the callback.
   * @param {{ scope: string|string[], state?: string }} opts
   * @returns {{ url: string, codeVerifier: string, state: string }}
   */
  authorizationUrl({ scope, state } = {}) {
    const { codeVerifier, codeChallenge } = generatePkce();
    const st = state || b64url(crypto.randomBytes(16));
    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: Array.isArray(scope) ? scope.join(" ") : scope || "",
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      state: st,
    });
    return { url: `${this.baseUrl}/oauth/authorize?${params.toString()}`, codeVerifier, state: st };
  }

  /**
   * Exchange an authorization `code` (with the PKCE verifier) for tokens.
   * @param {{ code: string, codeVerifier: string }} opts
   * @returns {Promise<import("../index").TokenSet>}
   */
  async exchangeCode({ code, codeVerifier }) {
    return this.#token({
      grant_type: "authorization_code",
      code,
      redirect_uri: this.redirectUri,
      code_verifier: codeVerifier,
    });
  }

  /**
   * Refresh an access token. Refresh tokens rotate — store the returned one.
   * @param {string} refreshToken
   * @returns {Promise<import("../index").TokenSet>}
   */
  async refresh(refreshToken) {
    return this.#token({ grant_type: "refresh_token", refresh_token: refreshToken });
  }

  /**
   * Revoke an access or refresh token (RFC 7009). Always resolves.
   * @param {string} token
   * @returns {Promise<void>}
   */
  async revoke(token) {
    await fetch(`${this.baseUrl}/oauth/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }).toString(),
    });
  }

  async #token(extra) {
    const form = { client_id: this.clientId, ...extra };
    if (this.clientSecret) form.client_secret = this.clientSecret;
    const res = await fetch(`${this.baseUrl}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(form).toString(),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.access_token) {
      // EvoMapError signature is (status, body, headers) — pass the parsed body so
      // error / error_description / type / request_id all survive. (Passing the
      // bare strings here used to drop every field to request_failed/null.)
      throw new EvoMapError(res.status, json, res.headers);
    }
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      tokenType: json.token_type,
      expiresIn: json.expires_in,
      scope: json.scope,
    };
  }
}
