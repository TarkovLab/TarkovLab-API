const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@as-integrations/express4');
const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const { tarkovLandingPagePlugin } = require('./tarkovLandingPage');

const DATA_ORIGIN = 'https://data.tarkovlab.org';

// ---------------------
// Data loading (fetched from data.tarkovlab.org, cached in memory)
// ---------------------
let cachedAchievements = null;
let cachedAchievementsGlobal = null;

function parseAchievements(raw) {
  const parsed = JSON.parse(raw);
  if (parsed?.data?.global) cachedAchievementsGlobal = parsed.data.global;
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed?.achievements)) return parsed.achievements;
  if (Array.isArray(parsed?.data?.achievements)) return parsed.data.achievements;
  return [];
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

async function loadAchievements() {
  if (cachedAchievements) return cachedAchievements;
  try {
    const raw = await fetchJson(`${DATA_ORIGIN}/achievements.json`);
    cachedAchievements = parseAchievements(raw);
    return cachedAchievements;
  } catch {
    cachedAchievements = [];
    return [];
  }
}

async function refreshData() {
  try {
    const raw = await fetchJson(`${DATA_ORIGIN}/achievements.json`);
    cachedAchievements = parseAchievements(raw);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Failed to refresh data:`, err.message);
  }
}

function startDataRefresh() {
  refreshData();
  setInterval(refreshData, 60_000);
  console.log(`Data will be refreshed every 60 seconds from ${DATA_ORIGIN}`);
}

// ---------------------
// GraphQL Schema
// ---------------------
const typeDefs = `#graphql
  type Achievement {
    id: String!
    name: String!
    description: String
    rarity: String
    normalizedRarity: String
    hidden: Boolean
    imageLink: String
    gameId: String
    category: String
    PvPOnly: Boolean
  }

  type AchievementsMeta {
    wikilink: String
    antifandomLink: String
  }

  type Query {
    """Get all achievements"""
    achievements: [Achievement!]!

    """Get a single achievement by its id"""
    achievement(id: String!): Achievement

    """Get achievements filtered by rarity (e.g. \"common\", \"rare\", \"legendary\")"""
    achievementsByRarity(rarity: String!): [Achievement!]!

    """Get achievements metadata (wikilinks, etc.)"""
    achievementsMeta: AchievementsMeta
  }
`;

// ---------------------
// Resolvers
// ---------------------
const resolvers = {
  Query: {
    achievements: async () => await loadAchievements(),
    achievement: async (_, { id }) => {
      const achievements = await loadAchievements();
      return achievements.find((a) => a.id === id) || null;
    },
    achievementsByRarity: async (_, { rarity }) => {
      const achievements = await loadAchievements();
      const target = String(rarity).toLowerCase();
      return achievements.filter(
        (a) => (a.normalizedRarity || String(a.rarity || '').toLowerCase()) === target,
      );
    },
    achievementsMeta: async () => {
      await loadAchievements();
      return cachedAchievementsGlobal || null;
    },
  },
};

// ---------------------
// Server bootstrap
// ---------------------
async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);

  const server = new ApolloServer({
    typeDefs,
    resolvers,
    introspection: true,
    plugins: [tarkovLandingPagePlugin],
  });

  await server.start();

  app.use(express.static(path.join(__dirname)));

  // Proxy /achievements.json to data.tarkovlab.org
  app.get('/achievements.json', async (_req, res) => {
    try {
      const raw = await fetchJson(`${DATA_ORIGIN}/achievements.json`);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.status(200).send(raw);
    } catch {
      res.status(502).json({ error: 'Failed to fetch from data.tarkovlab.org' });
    }
  });

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'OK' });
  });

  app.use(
    '/graphql',
    cors(),
    express.json(),
    expressMiddleware(server),
  );

  app.get('/', (_req, res) => {
    res.redirect('/graphql');
  });

  startDataRefresh();

  const PORT = process.env.PORT || 3000;
  httpServer.listen(PORT, () => {
    console.log(`Server ready at http://localhost:${PORT}/graphql`);
    console.log(`Proxy /achievements.json -> ${DATA_ORIGIN}/achievements.json`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
