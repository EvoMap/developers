/**
 * Error thrown for any non-2xx EvoMap API response. `code` is the machine-
 * readable error string from the API (e.g. `invalid_token`, `insufficient_scope`,
 * `approval_required_for_scopes`, `quota_exceeded`); `status` is the HTTP status.
 */
export class EvoMapError extends Error {
  /**
   * @param {number} status
   * @param {string} code
   * @param {string} [description]
   * @param {Headers} [headers]
   */
  constructor(status, code, description, headers) {
    super(description ? `${code}: ${description}` : code);
    this.name = "EvoMapError";
    this.status = status;
    this.code = code;
    /** When the response is a 429 publish-quota error, the ISO instant quota resets. */
    this.quotaRestoredAt = headers?.get?.("x-quota-restored-at") || null;
  }
}
