let allAchievements = [];
let queryEditor = null;
let totalPackets = 0;

const schemaDocs = {
  Query: {
    description: "The root query fields to retrieve achievements.",
    fields: [
      { name: "achievements", type: "[Achievement!]!", desc: "Get all achievements." },
      { name: "achievement(id: String!)", type: "Achievement", desc: "Get a single achievement by its id." },
      { name: "achievementsByRarity(rarity: String!)", type: "[Achievement!]!", desc: "Get achievements filtered by rarity (e.g. \"common\", \"rare\", \"legendary\")." },
      { name: "achievementsMeta", type: "AchievementsMeta", desc: "Get achievements metadata (wikilinks, etc.)." }
    ]
  },
  Achievement: {
    description: "An achievement that can be unlocked by performing specific actions.",
    fields: [
      { name: "id", type: "String!", desc: "Unique identifier for this achievement." },
      { name: "name", type: "String!", desc: "Display name of the achievement." },
      { name: "description", type: "String", desc: "Description of how to unlock the achievement." },
      { name: "rarity", type: "String", desc: "Rarity tier (e.g. Common, Rare, Legendary)." },
      { name: "normalizedRarity", type: "String", desc: "Lowercase normalized rarity value." },
      { name: "hidden", type: "Boolean", desc: "Whether the achievement is hidden until unlocked." },
      { name: "imageLink", type: "String", desc: "URL to the achievement icon." },
      { name: "gameId", type: "String", desc: "Raw internal game database hash." },
      { name: "category", type: "String", desc: "Category the achievement belongs to (e.g. raid, kill)." },
      { name: "PvPOnly", type: "Boolean", desc: "Whether this achievement requires PvP mode." }
    ]
  },
  AchievementsMeta: {
    description: "Metadata for achievements including wiki links.",
    fields: [
      { name: "wikilink", type: "String", desc: "Link to the Tarkov wiki achievements page." },
      { name: "antifandomLink", type: "String", desc: "Link to the antifandom wiki achievements page." }
    ]
  }
};

const queryPresets = {
  allAchievements: `query FetchAllAchievements {
  achievements {
    id
    name
    description
    rarity
    normalizedRarity
    category
    imageLink
    PvPOnly
  }
}`,
  singleAchievement: `query FetchSingleAchievement {
  achievement(id: "achievements-pmc_s_best_friend") {
    id
    name
    description
    rarity
    category
    imageLink
  }
}`,
  achievementsByRarity: `query FetchByRarity {
  achievementsByRarity(rarity: "legendary") {
    id
    name
    description
    rarity
    category
  }
}`,
  achievementsMeta: `query FetchAchievementsMeta {
  achievementsMeta {
    wikilink
    antifandomLink
  }
}`
};

window.addEventListener('DOMContentLoaded', async () => {
  initEditor();
  queryEditor.setValue(queryPresets.allAchievements);
  initTheme();
  buildExplorerTree();
  buildCommandsModal();
  checkStatus();

  await fetchAllAchievementsFromServer();

  showSchemaType('Query');
});

function initEditor() {
  const editorTextarea = document.getElementById('graphql-editor');
  queryEditor = CodeMirror.fromTextArea(editorTextarea, {
    mode: 'javascript',
    lineNumbers: true,
    theme: 'default',
    tabSize: 2,
    indentWithTabs: false,
    lineWrapping: true
  });
}

async function fetchAllAchievementsFromServer() {
  const query = `query {
    achievements {
      id
      name
      description
      rarity
      normalizedRarity
      hidden
      imageLink
      gameId
      category
      PvPOnly
    }
  }`;

  try {
    const res = await fetch('/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ query })
    });
    const result = await res.json();
    if (result.data && result.data.achievements) {
      allAchievements = result.data.achievements;
      totalPackets += 1;
      document.getElementById('packets-count').textContent = totalPackets;
    }
  } catch (err) {
    console.error("Failed to load achievements database:", err);
  }
}


async function runQuery() {
  const query = queryEditor.getValue();
  const deployBtn = document.getElementById('btn-deploy');
  const outputEl = document.getElementById('telemetry-output');
  const uplinkVal = document.getElementById('uplink-status-value');

  deployBtn.disabled = true;
  deployBtn.textContent = 'EXECUTING...';
  uplinkVal.textContent = 'Sending...';

  const startTime = performance.now();

  try {
    const res = await fetch('/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ query })
    });

    const duration = (performance.now() - startTime).toFixed(0);
    const data = await res.json();

    totalPackets++;
    document.getElementById('packets-count').textContent = totalPackets;

    outputEl.textContent = JSON.stringify(data, null, 2);
    outputEl.style.color = data.errors ? 'var(--accent-red-bright)' : '#9fadb5';

    document.getElementById('telemetry-status').textContent = `${res.status} ${res.statusText}`;
    document.getElementById('telemetry-status').style.color = res.ok ? 'var(--accent-green-bright)' : 'var(--accent-red-bright)';
    document.getElementById('telemetry-rtt').textContent = `${duration}ms`;

    const size = (JSON.stringify(data).length / 1024).toFixed(2);
    document.getElementById('telemetry-size').textContent = `${size} KB`;

    uplinkVal.textContent = data.errors ? 'Errors Returned' : 'Success';

  } catch (err) {
    const duration = (performance.now() - startTime).toFixed(0);
    outputEl.textContent = JSON.stringify({ error: err.message }, null, 2);
    outputEl.style.color = 'var(--accent-red-bright)';
    document.getElementById('telemetry-status').textContent = 'Error';
    document.getElementById('telemetry-status').style.color = 'var(--accent-red-bright)';
    document.getElementById('telemetry-rtt').textContent = `${duration}ms`;
    document.getElementById('telemetry-size').textContent = '0 KB';
    uplinkVal.textContent = 'Connection Failed';
  } finally {
    deployBtn.disabled = false;
    deployBtn.textContent = 'RUN QUERY';
  }
}

function loadQueryPreset(presetKey) {
  if (queryPresets[presetKey]) {
    queryEditor.setValue(queryPresets[presetKey]);
  }
}

function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    if (btn.getAttribute('data-tab') === tabId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  document.querySelectorAll('.tab-pane').forEach(pane => {
    if (pane.id === tabId) {
      pane.classList.add('active');
      if (tabId === 'console-tab' && queryEditor) {
        setTimeout(() => queryEditor.refresh(), 10);
      }
    } else {
      pane.classList.remove('active');
    }
  });
}

function showSchemaType(typeName) {
  document.querySelectorAll('.schema-nav-item').forEach(item => {
    if (item.textContent.includes(typeName)) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  const doc = schemaDocs[typeName];
  const contentEl = document.getElementById('schema-details-content');
  if (!doc) return;

  let fieldsHtml = '';
  if (doc.fields && doc.fields.length > 0) {
    fieldsHtml = doc.fields.map(f => `
      <tr>
        <td class="field-name">${f.name}</td>
        <td class="field-type">${f.type}</td>
        <td class="field-desc">${f.desc}</td>
      </tr>
    `).join('');
  }

  contentEl.innerHTML = `
    <div class="schema-details-title">
      ${typeName.toUpperCase()}
      <span class="schema-details-subtitle">Schema Type</span>
    </div>
    <div class="schema-description">${doc.description}</div>
    
    <h3 style="font-family: var(--font-header); font-size: 14px; letter-spacing: 0.5px; color: var(--text-bright); margin-bottom: 8px;">Fields</h3>
    <table class="schema-table">
      <thead>
        <tr>
          <th style="width: 25%;">Field</th>
          <th style="width: 25%;">Type</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        ${fieldsHtml}
      </tbody>
    </table>
    
    <div style="margin-top: 20px; display: flex; gap: 8px; align-items: center;">
      <button class="btn-tarkov" style="font-size: 11px;" onclick="loadPresetForType('${typeName}')">Load template in console</button>
    </div>
  `;
}

function loadPresetForType(typeName) {
  if (typeName === 'Query') {
    loadQueryPreset('allAchievements');
  } else if (typeName === 'Achievement') {
    loadQueryPreset('singleAchievement');
  } else if (typeName === 'AchievementsMeta') {
    loadQueryPreset('achievementsMeta');
  } else {
    loadQueryPreset('allAchievements');
  }
  switchTab('console-tab');
}

function initTheme() {
  const saved = localStorage.getItem('tarkovlab-theme') || 'dark';
  setTheme(saved);

  document.addEventListener('click', (e) => {
    const panel = document.getElementById('settings-panel');
    const btn = document.getElementById('settings-btn');
    if (!panel.classList.contains('d-none') && !panel.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
      panel.classList.add('d-none');
    }
  });
}

function toggleSettingsPanel() {
  document.getElementById('settings-panel').classList.toggle('d-none');
}

function setTheme(theme) {
  document.body.classList.toggle('theme-light', theme === 'light');
  document.getElementById('theme-btn-dark').classList.toggle('active', theme === 'dark');
  document.getElementById('theme-btn-light').classList.toggle('active', theme === 'light');
  localStorage.setItem('tarkovlab-theme', theme);
  if (queryEditor) {
    setTimeout(() => queryEditor.refresh(), 10);
  }
}

const quickCommands = [
  {
    title: 'Fetch all achievements',
    desc: 'Basic query returning all achievements.',
    query: `{\n  achievements {\n    id\n    name\n  }\n}`
  },
  {
    title: 'Fetch a single achievement by ID',
    desc: 'Use the achievement(id: String!) field to target one achievement.',
    query: `{\n  achievement(id: "achievements-traveler") {\n    name\n    description\n    rarity\n  }\n}`
  },
  {
    title: 'Filter achievements by rarity',
    desc: 'achievementsByRarity accepts a rarity value like "common", "rare" or "legendary".',
    query: `{\n  achievementsByRarity(rarity: "legendary") {\n    name\n    description\n    category\n  }\n}`
  },
  {
    title: 'Achievement metadata',
    desc: 'Get wiki links and other metadata for achievements.',
    query: `{\n  achievementsMeta {\n    wikilink\n    antifandomLink\n  }\n}`
  },
  {
    title: 'Hidden achievements only',
    desc: 'Fetch achievements that are hidden until unlocked.',
    query: `{\n  achievements {\n    id\n    name\n    hidden\n    description\n  }\n}`
  },
  {
    title: 'Named query & field alias',
    desc: 'Name your operation and rename a field with an alias.',
    query: `query MyAchievements {\n  achievements {\n    achievementName: name\n    difficulty: rarity\n  }\n}`
  }
];

function buildCommandsModal() {
  const body = document.getElementById('commands-modal-body');
  body.innerHTML = quickCommands.map((c, idx) => `
    <div class="command-card">
      <div class="command-card-head">
        <span class="command-card-title">${c.title}</span>
        <button class="btn-tarkov" style="font-size: 10.5px; padding: 5px 10px;" onclick="useQuickCommand(${idx})">Use</button>
      </div>
      <div class="command-card-desc">${c.desc}</div>
      <pre class="command-card-code">${c.query}</pre>
    </div>
  `).join('');
}

function useQuickCommand(idx) {
  queryEditor.setValue(quickCommands[idx].query);
  toggleCommandsModal();
  switchTab('console-tab');
}

function toggleCommandsModal() {
  document.getElementById('commands-modal-overlay').classList.toggle('d-none');
}

function closeCommandsModalOnOverlay(e) {
  if (e.target.id === 'commands-modal-overlay') {
    toggleCommandsModal();
  }
}

function stripGqlType(type) {
  return type.replace(/[\[\]!]/g, '');
}

function buildExplorerFieldsHTML(typeName, pathPrefix, depth) {
  const doc = schemaDocs[typeName];
  if (!doc || depth > 4) return '';

  return doc.fields.map(f => {
    const fieldName = f.name.split('(')[0];
    const childType = stripGqlType(f.type);
    const isObject = !!schemaDocs[childType];
    const path = pathPrefix ? `${pathPrefix}.${fieldName}` : fieldName;

    if (isObject) {
      return `
        <details class="explorer-node">
          <summary>
            <label onclick="event.stopPropagation()">
              <input type="checkbox" data-path="${path}" onclick="onExplorerCheck(event)">
              <span class="explorer-field-name">${fieldName}</span>
              <span class="explorer-field-type">${childType}</span>
            </label>
          </summary>
          <div class="explorer-children">
            ${buildExplorerFieldsHTML(childType, path, depth + 1)}
          </div>
        </details>`;
    }

    return `
      <div class="explorer-leaf">
        <label>
          <input type="checkbox" data-path="${path}" onclick="onExplorerCheck(event)">
          <span class="explorer-field-name">${fieldName}</span>
          <span class="explorer-field-type">${f.type}</span>
        </label>
      </div>`;
  }).join('');
}

function buildExplorerTree() {
  document.getElementById('explorer-tree').innerHTML = buildExplorerFieldsHTML('Achievement', '', 0);
}

function onExplorerCheck(e) {
  const cb = e.target;
  const node = cb.closest('.explorer-node');
  let parentNode = cb.closest('.explorer-children');
  while (parentNode) {
    const parentDetails = parentNode.closest('.explorer-node');
    if (!parentDetails) break;
    const parentCheckbox = parentDetails.querySelector(':scope > summary input[type="checkbox"]');
    if (cb.checked && parentCheckbox) parentCheckbox.checked = true;
    parentNode = parentDetails.parentElement.closest('.explorer-children');
  }
}

function onExplorerOperationChange() {
  const op = document.getElementById('explorer-operation').value;
  document.getElementById('explorer-id-input').classList.toggle('d-none', op !== 'achievement');
}

function clearExplorerSelection() {
  document.querySelectorAll('#explorer-tree input[type="checkbox"]').forEach(cb => cb.checked = false);
}

function buildSelectionSetFromPaths(paths) {
  const tree = {};
  paths.forEach(p => {
    const parts = p.split('.');
    let node = tree;
    parts.forEach(part => {
      node[part] = node[part] || {};
      node = node[part];
    });
  });

  function stringify(node, indent) {
    const pad = '  '.repeat(indent);
    return Object.keys(node).map(key => {
      const children = node[key];
      if (Object.keys(children).length === 0) {
        return `${pad}${key}`;
      }
      return `${pad}${key} {\n${stringify(children, indent + 1)}\n${pad}}`;
    }).join('\n');
  }

  return stringify(tree, 2);
}

function generateExplorerQuery() {
  const checked = Array.from(document.querySelectorAll('#explorer-tree input[type="checkbox"]:checked'))
    .map(cb => cb.dataset.path);

  if (checked.length === 0) {
    alert('Select at least one field in the explorer tree.');
    return;
  }

  const selectionSet = buildSelectionSetFromPaths(checked);
  const op = document.getElementById('explorer-operation').value;
  let query;

  if (op === 'achievements') {
    query = `query ExplorerQuery {\n  achievements {\n${selectionSet}\n  }\n}`;
  } else if (op === 'achievement') {
    const id = document.getElementById('explorer-id-input').value || 'achievements-traveler';
    query = `query ExplorerQuery {\n  achievement(id: "${id}") {\n${selectionSet}\n  }\n}`;
  } else {
    query = `query ExplorerQuery {\n  achievementsByRarity(rarity: "legendary") {\n${selectionSet}\n  }\n}`;
  }

  queryEditor.setValue(query);
}
