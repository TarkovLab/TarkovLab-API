const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const { tarkovLandingPagePlugin } = require('./tarkovLandingPage');


// ---------------------
// Data loading (with robust local -> cache -> GitHub fetch fallback)
// ---------------------
let cachedAchievements = null;
let cachedAchievementsGlobal = null;

async function loadAchievements() {
  if (cachedAchievements) return cachedAchievements;

  // Try 1: Remote data server data.tarkovlab.org
  try {
    const res = await fetch('https://data.tarkovlab.org/achievements.json');
    if (res.ok) {
      const parsed = JSON.parse(await res.text());
      if (parsed?.data?.global) cachedAchievementsGlobal = parsed.data.global;
      if (Array.isArray(parsed)) cachedAchievements = parsed;
      else if (Array.isArray(parsed?.achievements)) cachedAchievements = parsed.achievements;
      else if (Array.isArray(parsed?.data?.achievements)) cachedAchievements = parsed.data.achievements;
      else cachedAchievements = [];
      return cachedAchievements;
    }
  } catch { }

  // Try 2: GitHub backup
  try {
    const res = await fetch('https://raw.githubusercontent.com/TarkovLab/TarkovData/master/data/achievements.json');
    if (res.ok) {
      const parsed = JSON.parse(await res.text());
      if (parsed?.data?.global) cachedAchievementsGlobal = parsed.data.global;
      if (Array.isArray(parsed)) cachedAchievements = parsed;
      else if (Array.isArray(parsed?.achievements)) cachedAchievements = parsed.achievements;
      else if (Array.isArray(parsed?.data?.achievements)) cachedAchievements = parsed.data.achievements;
      else cachedAchievements = [];
      return cachedAchievements;
    }
  } catch { }

  cachedAchievements = [];
  return [];
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
    // Enable the embedded Apollo Sandbox (playground) in all environments
    introspection: true,
    plugins: [tarkovLandingPagePlugin],
  });

  await server.start();

  // Serve static assets (landingPage.js, etc.)
  app.use(express.static(path.join(__dirname)));

  // Health check – classic REST endpoint
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'OK' });
  });

  // GraphQL endpoint with Apollo Sandbox as playground
  app.use(
    '/graphql',
    cors(),
    express.json(),
    expressMiddleware(server),
  );

  // Redirect root to playground
  app.get('/', (_req, res) => {
    res.redirect('/graphql');
  });

  const PORT = process.env.PORT || 3000;
  httpServer.listen(PORT, () => {
    console.log(`Server ready at http://localhost:${PORT}/graphql`);
    console.log(`Health check at http://localhost:${PORT}/health`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
