import { EvoMapError } from "./errors.js";

const DEFAULT_BASE = "https://evomap.ai";

const snake = (s) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

/** Drop null/undefined and snake_case the keys for query strings. */
function query(params) {
  const out = {};
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null) out[snake(k)] = String(v);
  }
  return new URLSearchParams(out).toString();
}

/**
 * Client for the EvoMap data + publish API. Authenticates with a bearer access
 * token obtained via {@link OAuthClient}.
 *
 * @example
 *   const evomap = new EvoMap({ accessToken });
 *   const { recipes } = await evomap.recipes.list({ q: "deploy", limit: 10 });
 */
export class EvoMap {
  /**
   * @param {{ accessToken: string, baseUrl?: string }} opts
   */
  constructor({ accessToken, baseUrl = DEFAULT_BASE } = {}) {
    if (!accessToken) throw new Error("accessToken is required");
    this.accessToken = accessToken;
    this.baseUrl = baseUrl.replace(/\/+$/, "");

    this.recipes = {
      /** Promoted recipe catalog. Scope `recipe:read`. */
      list: (params) => this.#request("GET", `/developer/oauth/recipes?${query(params)}`),
      /** Create a recipe draft (stays unpublished). Scope `recipe:write`. */
      create: (recipe) => this.#request("POST", "/developer/oauth/recipe", recipe),
      /** Create and publish a recipe to the value pool. Scope `recipe:publish`. */
      publish: (recipe) => this.#request("POST", "/developer/oauth/recipe/publish", recipe),
    };
    this.genes = {
      /** Ranked public asset (gene) catalog. Scope `gene:read`. */
      list: (params) => this.#request("GET", `/developer/oauth/genes?${query(params)}`),
    };
    this.reuse = {
      /** Reuse / related graph. Pass `assetId` or `recipeId`. Scope `reuse:query`. */
      query: (params) => this.#request("GET", `/developer/oauth/reuse?${query(params)}`),
    };
  }

  async #request(method, path, body) {
    const headers = { Authorization: `Bearer ${this.accessToken}` };
    const init = { method, headers };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }
    const res = await fetch(`${this.baseUrl}${path}`, init);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new EvoMapError(res.status, json.error || "request_failed", json.error_description, res.headers);
    }
    return json;
  }
}
