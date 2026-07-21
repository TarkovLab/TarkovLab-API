## Overview

**TarkovLab API** is the public GraphQL API behind [tarkovlab.org](https://tarkovlab.org). It serves structured **Escape From Tarkov** game data — achievements, quests, items, traders, hideout crafts, and more — powered by the community-maintained [tarkovdata](https://github.com/TarkovLab/tarkovdata) dataset.

```
https://api.tarkovlab.org/graphql
```

Zero auth. Open CORS. Introspection enabled.

## Local Development

```bash
git clone https://github.com/TarkovLab/tarkovlab.git
cd tarkovlab/tarkovlab-api
npm install
npm start
```

The API starts on `http://localhost:3000` (or `$PORT`).

## License

MIT &copy; 2026 [TarkovLab](https://github.com/TarkovLab). See [LICENSE](LICENSE).
