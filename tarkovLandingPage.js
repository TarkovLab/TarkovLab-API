const fs = require('fs');
const path = require('path');

/**
 * A custom Apollo Server plugin that overrides the default Apollo Sandbox
 * with a high-fidelity, interactive, Tarkov-themed GraphQL client and quest tracker.
 */
const tarkovLandingPagePlugin = {
  async serverWillStart() {
    return {
      async renderLandingPage() {
        const htmlPath = path.join(__dirname, 'landingPage.html');
        const html = fs.readFileSync(htmlPath, 'utf8');
        return { html };
      },
    };
  },
};

module.exports = { tarkovLandingPagePlugin };
