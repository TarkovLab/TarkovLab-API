const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { tarkovLandingPagePlugin } = require('./tarkovLandingPage');


// ---------------------
// Data loading (with robust local -> cache -> GitHub fetch fallback)
// ---------------------
const dataDir = path.join(__dirname, '..', 'TarkovData', 'data');
let cachedQuests = null;

async function loadQuests() {
  if (cachedQuests) {
    return cachedQuests;
  }

  // Try 1: Sibling TarkovData repository (local development)
  try {
    const localPath = path.join(dataDir, 'quests.json');
    if (fs.existsSync(localPath)) {
      const raw = fs.readFileSync(localPath, 'utf8');
      cachedQuests = JSON.parse(raw);
      console.log('Successfully loaded quests from local TarkovData sibling directory.');
      return cachedQuests;
    }
  } catch (e) {
    console.warn('Could not load quests from local TarkovData:', e.message);
  }

  // Try 2: Local cached copy in the API directory
  const apiLocalPath = path.join(__dirname, 'data', 'quests.json');
  try {
    if (fs.existsSync(apiLocalPath)) {
      const raw = fs.readFileSync(apiLocalPath, 'utf8');
      cachedQuests = JSON.parse(raw);
      console.log('Successfully loaded quests from API local cache.');
      return cachedQuests;
    }
  } catch (e) {
    console.warn('Could not load quests from API local cache:', e.message);
  }

  // Try 3: Fetch from remote GitHub repository
  try {
    console.log('Fetching quests from GitHub repository...');
    const url = 'https://raw.githubusercontent.com/TarkovLab/TarkovData/master/data/quests.json';
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const text = await response.text();
    cachedQuests = JSON.parse(text);

    // Cache the fetched data locally
    try {
      const apiLocalDir = path.dirname(apiLocalPath);
      if (!fs.existsSync(apiLocalDir)) {
        fs.mkdirSync(apiLocalDir, { recursive: true });
      }
      fs.writeFileSync(apiLocalPath, text, 'utf8');
      console.log('Successfully cached fetched quests locally to', apiLocalPath);
    } catch (writeErr) {
      console.warn('Could not cache fetched quests locally:', writeErr.message);
    }

    return cachedQuests;
  } catch (e) {
    console.error('Failed to load quests from all sources:', e.message);
    throw e;
  }
}

// ---------------------
// GraphQL Schema
// ---------------------
const typeDefs = `#graphql
  type GPS {
    leftPercent: Float
    topPercent: Float
    floor: String
  }

  type Objective {
    id: Int
    type: String
    target: String
    number: Int
    location: Int
    gps: GPS
  }

  type Reputation {
    trader: Int
    rep: Float
  }

  type QuestRequirement {
    level: Int
    quests: [Int]
  }

  type Locales {
    en: String
    ru: String
    cs: String
  }

  type Quest {
    id: Int!
    title: String!
    locales: Locales
    wiki: String
    exp: Int
    giver: Int
    turnin: Int
    gameId: String
    require: QuestRequirement
    unlocks: [String]
    reputation: [Reputation]
    objectives: [Objective]
  }

  type Query {
    """Get all quests"""
    quests: [Quest!]!

    """Get a single quest by its id"""
    quest(id: Int!): Quest

    """Get quests given by a specific trader (by trader index)"""
    questsByTrader(trader: Int!): [Quest!]!
  }
`;

// ---------------------
// Resolvers
// ---------------------
const resolvers = {
  Objective: {
    target: (parent) => {
      if (Array.isArray(parent.target)) {
        return JSON.stringify(parent.target);
      }
      return parent.target !== undefined && parent.target !== null ? String(parent.target) : null;
    },
  },
  Query: {
    quests: async () => await loadQuests(),
    quest: async (_, { id }) => {
      const quests = await loadQuests();
      return quests.find((q) => q.id === id) || null;
    },
    questsByTrader: async (_, { trader }) => {
      const quests = await loadQuests();
      return quests.filter((q) => q.giver === trader);
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
    console.log(`🚀 Server ready at http://localhost:${PORT}/graphql`);
    console.log(`❤️  Health check at http://localhost:${PORT}/health`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
