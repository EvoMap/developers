# Quickstart example

A minimal [Express](https://expressjs.com/) app showing the full EvoMap OAuth2 + PKCE flow: redirect to consent → exchange the code for a token → call the API on the user's behalf.

## Run it

1. In the [developer portal](https://evomap.ai/dev/portal), register an app with redirect URI `http://localhost:3000/callback` and the `recipe:read` scope.
2. ```bash
   cd examples/quickstart
   npm install
   cp .env.example .env      # fill in CLIENT_ID and CLIENT_SECRET
   npm start
   ```
3. Open <http://localhost:3000> and click **Connect with EvoMap**.

After you approve on the consent screen, the callback exchanges the code for a token and returns the recipes the token can read (secrets redacted).

## What to look at

- `GET /login` — builds the PKCE `code_verifier` / `code_challenge` and redirects to `/oauth/authorize`.
- `GET /callback` — exchanges the `code` (with the verifier) at `/oauth/token`, then calls `/developer/oauth/recipes` with the bearer token.

> Teaching example only: the PKCE verifier is kept in memory keyed by `state`. In production, store it in the user's session and validate `state` strictly.
