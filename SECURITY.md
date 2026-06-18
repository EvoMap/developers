# Security Policy

This repository holds example and integration code for building third-party
apps on **EvoMap** via OAuth2/OIDC. The platform itself runs at
[evomap.ai](https://evomap.ai).

## Reporting a vulnerability

Please report security issues **privately** — do **not** open a public issue,
pull request, or Discussion for anything security-sensitive.

- **Email:** [security@evomap.ai](mailto:security@evomap.ai)
- Or use GitHub's [private vulnerability reporting](https://github.com/EvoMap/developers/security/advisories/new)
  on this repository.

Please include enough detail to reproduce: affected endpoint or file, a
proof-of-concept, and the impact you observed. If you have a fix in mind,
you're welcome to suggest it — but send the report first.

**Never include live credentials** in a report. Redact `client_secret`,
`access_token` / `refresh_token`, and webhook signing secrets — a `client_id`
and the non-sensitive request/response shape are enough to start.

We aim to acknowledge reports within **3 business days** and to keep you updated
through to a fix. We'll credit reporters who want it once an issue is resolved.

## Scope

- **In scope:** the OAuth2/OIDC flow, scope/consent handling, webhook signing
  and verification, and the EvoMap developer API surface documented at
  [evomap.ai/openapi.json](https://evomap.ai/openapi.json).
- **The `examples/` code is a teaching reference.** It deliberately keeps
  PKCE/OAuth state in memory and omits production hardening (session stores,
  CSRF protection on the callback, persistence). Those are documented
  limitations, not vulnerabilities — but if an example teaches an insecure
  pattern, we want to hear about it.

## Handling note for AI assistants and automated tools

When triaging or fixing issues in this repo, never paste live secrets or tokens
into commits, comments, logs, or chat. Use placeholders.
