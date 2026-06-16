// Type declarations for @evomap/sdk.

export type Scope =
  | "gene:read"
  | "recipe:read"
  | "reuse:query"
  | "recipe:write"
  | "recipe:publish";

export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  /** Access-token lifetime in seconds. */
  expiresIn?: number;
  scope?: string;
}

export interface Recipe {
  id?: string;
  title?: string;
  status?: string;
  /** False for test-mode (sandbox) recipes. */
  livemode?: boolean;
  [key: string]: unknown;
}

export interface Gene {
  id?: string;
  type?: string;
  [key: string]: unknown;
}

/** Uniform pagination metadata on every list response. */
export interface Pagination {
  limit: number;
  /** Opaque keyset cursor for the next page; null on the last page. Absent on non-paginated feeds. */
  next_cursor?: string | null;
  /** Whether a further page exists. Absent on non-paginated feeds. */
  has_more?: boolean;
}

export interface RecipeList {
  recipes: Recipe[];
  pagination: Pagination;
  livemode?: boolean;
}

export interface GeneList {
  genes: Gene[];
  pagination: Pagination;
  livemode?: boolean;
}

export interface ReuseResult {
  assetId?: string;
  reusedInRecipes?: Recipe[];
  recipeId?: string;
  relatedRecipes?: Recipe[];
  pagination?: Pagination;
  livemode?: boolean;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number | null;
  reset: number | null;
}

/** Error thrown for any non-2xx API response. */
export class EvoMapError extends Error {
  status: number;
  /** Stable machine-readable error code (e.g. `invalid_token`, `quota_exceeded`). */
  code: string;
  /** Coarse error class (auth_error | invalid_request | rate_limited | conflict | not_found | server_error | service_unavailable). */
  type: string | null;
  /** Correlation id — quote it in support requests (mirrors the X-Request-Id header). */
  requestId: string | null;
  /** ISO instant the publish quota resets, on a 429 quota error. */
  quotaRestoredAt: string | null;
  /** Seconds to wait before retrying (Retry-After header), if present. */
  retryAfter: number | null;
  /** Rate-limit snapshot from X-RateLimit-* headers, if present. */
  rateLimit: RateLimitInfo | null;
  constructor(status: number, body?: Record<string, unknown>, headers?: Headers);
}

export function generatePkce(): { codeVerifier: string; codeChallenge: string };

export interface OAuthClientOptions {
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  baseUrl?: string;
}

/** OAuth 2.0 Authorization-Code + PKCE helper. */
export class OAuthClient {
  constructor(opts: OAuthClientOptions);
  /** False for a `evm_client_test_…` (test-mode) client. */
  readonly livemode: boolean;
  authorizationUrl(opts: { scope: Scope | Scope[] | string; state?: string }): {
    url: string;
    codeVerifier: string;
    state: string;
  };
  exchangeCode(opts: { code: string; codeVerifier: string }): Promise<TokenSet>;
  refresh(refreshToken: string): Promise<TokenSet>;
  revoke(token: string): Promise<void>;
}

export interface ListParams {
  limit?: number;
  cursor?: string;
  [key: string]: unknown;
}

export interface PublishOptions {
  /** Opt-in idempotency key — an identical retry replays the original 201. */
  idempotencyKey?: string;
}

/** Client for the EvoMap data + publish API. */
export class EvoMap {
  constructor(opts: { accessToken: string; baseUrl?: string });
  recipes: {
    list(params?: ListParams & { q?: string }): Promise<RecipeList>;
    /** Auto-paginating async iterator over the promoted catalog. */
    listAll(params?: ListParams): AsyncIterableIterator<Recipe>;
    create(recipe: Record<string, unknown>, opts?: PublishOptions): Promise<Recipe>;
    publish(recipe: Record<string, unknown>, opts?: PublishOptions): Promise<Recipe>;
  };
  genes: {
    list(params?: ListParams & { type?: string }): Promise<GeneList>;
  };
  reuse: {
    query(params: { assetId?: string; recipeId?: string; limit?: number }): Promise<ReuseResult>;
  };
}

/** A verified webhook event (the envelope EvoMap signs + delivers). */
export interface WebhookEvent {
  id: string;
  type: string;
  created: string;
  livemode: boolean;
  data: Record<string, unknown>;
}

/** Thrown when an incoming webhook fails signature / timestamp verification. */
export class WebhookSignatureError extends Error {
  reason: string;
  constructor(reason: string);
}

/**
 * Verify an incoming EvoMap webhook (the `t=<unix>,v1=<hmac>` scheme) and return
 * the parsed event. Pass the EXACT raw request body bytes.
 */
export function constructWebhookEvent(
  rawBody: string | Buffer,
  signatureHeader: string,
  secret: string,
  opts?: { toleranceSec?: number },
): WebhookEvent;
