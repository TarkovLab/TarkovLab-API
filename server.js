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
let cachedAchievements = null;

async function loadQuests() {
  if (cachedQuests) {
    return cachedQuests;
  }

  // Try 1: Remote data server data.tarkovlab.org
  try {
    console.log('Fetching quests from remote data server https://data.tarkovlab.org/quests.json ...');
    const response = await fetch('https://data.tarkovlab.org/quests.json');
    if (response.ok) {
      const text = await response.text();
      cachedQuests = JSON.parse(text);
      console.log('Successfully loaded quests from data.tarkovlab.org.');
      
      // Save/Cache locally as backup
      try {
        const apiLocalPath = path.join(__dirname, 'data', 'quests.json');
        const apiLocalDir = path.dirname(apiLocalPath);
        if (!fs.existsSync(apiLocalDir)) {
          fs.mkdirSync(apiLocalDir, { recursive: true });
        }
        fs.writeFileSync(apiLocalPath, text, 'utf8');
      } catch (writeErr) {
        console.warn('Could not cache remote quests locally:', writeErr.message);
      }
      
      return cachedQuests;
    } else {
      console.warn(`Failed to fetch from data.tarkovlab.org: HTTP ${response.status}`);
    }
  } catch (e) {
    console.warn('Could not fetch from data.tarkovlab.org:', e.message);
  }

  // Try 2: Local backup cache
  try {
    const apiLocalPath = path.join(__dirname, 'data', 'quests.json');
    if (fs.existsSync(apiLocalPath)) {
      const raw = fs.readFileSync(apiLocalPath, 'utf8');
      cachedQuests = JSON.parse(raw);
      console.log('Successfully loaded quests from local cache backup.');
      return cachedQuests;
    }
  } catch (e) {
    console.warn('Could not load quests from local cache backup:', e.message);
  }

  // Try 3: Sibling TarkovData repository (local development fallback)
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

  // Try 4: GitHub backup fallback
  try {
    console.log('Fetching quests from GitHub repository backup...');
    const url = 'https://raw.githubusercontent.com/TarkovLab/TarkovData/master/data/quests.json';
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const text = await response.text();
    cachedQuests = JSON.parse(text);
    return cachedQuests;
  } catch (e) {
    console.error('Failed to load quests from all sources:', e.message);
    throw e;
  }
}

// ---------------------
// Achievements loading (mirrors the quests fallback strategy)
// ---------------------
function extractAchievements(parsed) {
  // The raw file is shaped like { "data": { "achievements": [...] } }.
  // Be tolerant of a few possible shapes so the API stays robust.
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.achievements)) return parsed.achievements;
  if (parsed && parsed.data && Array.isArray(parsed.data.achievements)) {
    return parsed.data.achievements;
  }
  return [];
}

async function loadAchievements() {
  if (cachedAchievements) {
    return cachedAchievements;
  }

  // Try 1: Remote data server data.tarkovlab.org
  try {
    console.log('Fetching achievements from remote data server https://data.tarkovlab.org/achievements.json ...');
    const response = await fetch('https://data.tarkovlab.org/achievements.json');
    if (response.ok) {
      const text = await response.text();
      cachedAchievements = extractAchievements(JSON.parse(text));
      console.log('Successfully loaded achievements from data.tarkovlab.org.');

      // Save/Cache locally as backup
      try {
        const apiLocalPath = path.join(__dirname, 'data', 'achievements.json');
        const apiLocalDir = path.dirname(apiLocalPath);
        if (!fs.existsSync(apiLocalDir)) {
          fs.mkdirSync(apiLocalDir, { recursive: true });
        }
        fs.writeFileSync(apiLocalPath, text, 'utf8');
      } catch (writeErr) {
        console.warn('Could not cache remote achievements locally:', writeErr.message);
      }

      return cachedAchievements;
    } else {
      console.warn(`Failed to fetch achievements from data.tarkovlab.org: HTTP ${response.status}`);
    }
  } catch (e) {
    console.warn('Could not fetch achievements from data.tarkovlab.org:', e.message);
  }

  // Try 2: Local backup cache
  try {
    const apiLocalPath = path.join(__dirname, 'data', 'achievements.json');
    if (fs.existsSync(apiLocalPath)) {
      const raw = fs.readFileSync(apiLocalPath, 'utf8');
      cachedAchievements = extractAchievements(JSON.parse(raw));
      console.log('Successfully loaded achievements from local cache backup.');
      return cachedAchievements;
    }
  } catch (e) {
    console.warn('Could not load achievements from local cache backup:', e.message);
  }

  // Try 3: Sibling TarkovData repository (local development fallback)
  try {
    const localPath = path.join(dataDir, 'achievements.json');
    if (fs.existsSync(localPath)) {
      const raw = fs.readFileSync(localPath, 'utf8');
      cachedAchievements = extractAchievements(JSON.parse(raw));
      console.log('Successfully loaded achievements from local TarkovData sibling directory.');
      return cachedAchievements;
    }
  } catch (e) {
    console.warn('Could not load achievements from local TarkovData:', e.message);
  }

  // Try 4: GitHub backup fallback
  try {
    console.log('Fetching achievements from GitHub repository backup...');
    const url = 'https://raw.githubusercontent.com/TarkovLab/TarkovData/master/data/achievements.json';
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const text = await response.text();
    cachedAchievements = extractAchievements(JSON.parse(text));
    return cachedAchievements;
  } catch (e) {
    console.error('Failed to load achievements from all sources:', e.message);
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

  type Achievement {
    id: String!
    name: String!
    description: String
    rarity: String
    normalizedRarity: String
    hidden: Boolean
    imageLink: String
    gameId: String
  }

  type Query {
    """Get all quests"""
    quests: [Quest!]!

    """Get a single quest by its id"""
    quest(id: Int!): Quest

    """Get quests given by a specific trader (by trader index)"""
    questsByTrader(trader: Int!): [Quest!]!

    """Get all achievements"""
    achievements: [Achievement!]!

    """Get a single achievement by its id"""
    achievement(id: String!): Achievement

    """Get achievements filtered by rarity (e.g. \"common\", \"rare\", \"legendary\")"""
    achievementsByRarity(rarity: String!): [Achievement!]!
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
