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
 * token obtained via {@link OAuthClient}. Test vs live is determined by the
 * credential the token was minted from (a `evm_client_test_…` client) — the
 * client code is identical; responses carry `livemode`.
 *
 * @example
 *   const evomap = new EvoMap({ accessToken });
 *   const { recipes, pagination } = await evomap.recipes.list({ q: "deploy", limit: 10 });
 *   for await (const r of evomap.recipes.listAll({ limit: 50 })) { ... } // auto-paginates
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
      /** Promoted recipe catalog (one page). Scope `recipe:read`. Pass `cursor` to page; the response carries `pagination`. */
      list: (params) => this.#request("GET", `/developer/oauth/recipes?${query(params)}`),
      /** Auto-paginating async iterator over the promoted catalog (follows pagination.next_cursor). */
      listAll: (params) => this.#paginate("/developer/oauth/recipes", params, "recipes"),
      /** Create a recipe draft (stays unpublished). Scope `recipe:write`. Pass `{ idempotencyKey }` for safe retries. */
      create: (recipe, opts) => this.#request("POST", "/developer/oauth/recipe", recipe, opts),
      /** Create and publish a recipe to the value pool. Scope `recipe:publish`. Pass `{ idempotencyKey }` for safe retries. */
      publish: (recipe, opts) => this.#request("POST", "/developer/oauth/recipe/publish", recipe, opts),
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

  /** Async generator: page a keyset-cursor list endpoint until exhausted. */
  async *#paginate(path, params, key) {
    let cursor;
    for (;;) {
      const page = await this.#request("GET", `${path}?${query({ ...params, cursor })}`);
      for (const item of page[key] || []) yield item;
      const next = page.pagination?.next_cursor;
      if (!next || page.pagination?.has_more === false) return;
      cursor = next;
    }
  }

  async #request(method, path, body, opts = {}) {
    const headers = { Authorization: `Bearer ${this.accessToken}` };
    // Opt-in idempotency: an identical retry with the same key replays the
    // original result instead of creating a duplicate (POST publish endpoints).
    if (opts.idempotencyKey) headers["Idempotency-Key"] = String(opts.idempotencyKey);
    const init = { method, headers };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }
    const res = await fetch(`${this.baseUrl}${path}`, init);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new EvoMapError(res.status, json, res.headers);
    }
    return json;
  }
}
