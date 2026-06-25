const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { tarkovLandingPagePlugin } = require('./tarkovLandingPage');


// ---------------------
// Data loading
// ---------------------
const dataDir = path.join(__dirname, '..', 'TarkovData', 'data');

const loadQuests = () => {
  const filePath = path.join(dataDir, 'quests.json');
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
};

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
  Query: {
    quests: () => loadQuests(),
    quest: (_, { id }) => {
      const quests = loadQuests();
      return quests.find((q) => q.id === id) || null;
    },
    questsByTrader: (_, { trader }) => {
      const quests = loadQuests();
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
