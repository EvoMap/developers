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
  [key: string]: unknown;
}

export interface Gene {
  id?: string;
  type?: string;
  [key: string]: unknown;
}

export interface ReuseResult {
  assetId?: string;
  reusedInRecipes?: Recipe[];
  recipeId?: string;
  relatedRecipes?: Recipe[];
}

/** Error thrown for any non-2xx API response. */
export class EvoMapError extends Error {
  status: number;
  code: string;
  /** ISO instant the publish quota resets, on a 429 quota error. */
  quotaRestoredAt: string | null;
  constructor(status: number, code: string, description?: string, headers?: Headers);
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
  [key: string]: unknown;
}

/** Client for the EvoMap data + publish API. */
export class EvoMap {
  constructor(opts: { accessToken: string; baseUrl?: string });
  recipes: {
    list(params?: ListParams & { q?: string }): Promise<{ recipes: Recipe[] }>;
    create(recipe: Record<string, unknown>): Promise<Recipe>;
    publish(recipe: Record<string, unknown>): Promise<Recipe>;
  };
  genes: {
    list(params?: ListParams & { type?: string }): Promise<{ genes: Gene[] }>;
  };
  reuse: {
    query(params: { assetId?: string; recipeId?: string; limit?: number }): Promise<ReuseResult>;
  };
}
