# Tarkovlab API — Agent Guidelines

Apollo Server 4 + Express GraphQL API wrapping EFT game data.

- **No build step.** Edit `server.js` and restart.
- **Endpoints:** `GET /health` → `{ status: "OK" }`, `POST /graphql` → GraphQL (Apollo Sandbox playground enabled).
- **Data fallback chain** (see `server.js`): remote `data.tarkovlab.org` → local `./data/*` cache → sibling `../TarkovData/data/*` → GitHub raw. Caches remote data locally on first fetch.
- No tests (`npm test` is a noop). No linter.
