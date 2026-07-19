let allQuests = [];
let queryEditor = null;
let totalPackets = 0;

const schemaDocs = {
  Query: {
    description: "The root query fields to retrieve task profiles.",
    fields: [
      { name: "quests", type: "[Quest!]!", desc: "Acquires the full ledger of all tasks/quests." },
      { name: "quest(id: Int!)", type: "Quest", desc: "Retrieves a single quest profile by its integer ID." },
      { name: "questsByTrader(trader: Int!)", type: "[Quest!]!", desc: "Retrieves all quests issued by a specific trader using their index (0-7)." }
    ]
  },
  Quest: {
    description: "A task description containing prerequisites, rewards, and objectives.",
    fields: [
      { name: "id", type: "Int!", desc: "Unique identifier for this quest." },
      { name: "title", type: "String!", desc: "Operational name of the task." },
      { name: "locales", type: "Locales", desc: "Translations for international operations." },
      { name: "wiki", type: "String", desc: "External link to reference database (Fandom Wiki)." },
      { name: "exp", type: "Int", desc: "Experience points awarded upon completion." },
      { name: "giver", type: "Int", desc: "ID of the trader who issued the task (0-7)." },
      { name: "turnin", type: "Int", desc: "ID of the trader who receives the completed task (0-7)." },
      { name: "gameId", type: "String", desc: "Raw internal database hash code." },
      { name: "require", type: "QuestRequirement", desc: "PMC requirements that must be met to unlock this task." },
      { name: "unlocks", type: "[String]", desc: "Array of game hashes unlocked upon completion." },
      { name: "reputation", type: "[Reputation]", desc: "Reputation standing adjustments awarded." },
      { name: "objectives", type: "[Objective]", desc: "Operational objectives that must be fulfilled." }
    ]
  },
  Objective: {
    description: "A specific action that must be taken to satisfy a task's requirements.",
    fields: [
      { name: "id", type: "Int", desc: "Objective identifier index." },
      { name: "type", type: "String", desc: "Action type: 'kill', 'collect', 'pickup', 'key', 'locate', etc." },
      { name: "target", type: "String", desc: "Target name, item hash, or specific description of the objective." },
      { name: "number", type: "Int", desc: "Count or quantity required." },
      { name: "location", type: "Int", desc: "Location ID where the objective must be completed." },
      { name: "gps", type: "GPS", desc: "Tactical positioning coordinates, if available." }
    ]
  },
  GPS: {
    description: "Tactical positioning coordinates mapping the location of an objective.",
    fields: [
      { name: "leftPercent", type: "Float", desc: "X-axis percentage offset on the map." },
      { name: "topPercent", type: "Float", desc: "Y-axis percentage offset on the map." },
      { name: "floor", type: "String", desc: "Elevation or floor layer where the objective is located." }
    ]
  },
  Reputation: {
    description: "Reputation adjustment data indicating standing shifts with traders.",
    fields: [
      { name: "trader", type: "Int", desc: "ID of the trader whose reputation is adjusted (0-7)." },
      { name: "rep", type: "Float", desc: "Numeric value added or subtracted from standing." }
    ]
  },
  QuestRequirement: {
    description: "Prerequisites required of the PMC operator before the task unlocks.",
    fields: [
      { name: "level", type: "Int", desc: "Minimum PMC level required." },
      { name: "quests", type: "[Int]", desc: "Prior quest IDs that must be completed." }
    ]
  },
  Locales: {
    description: "Localization strings.",
    fields: [
      { name: "en", type: "String", desc: "English localization." },
      { name: "ru", type: "String", desc: "Russian localization." },
      { name: "cs", type: "String", desc: "Czech localization." }
    ]
  }
};

const queryPresets = {
  allQuests: `query FetchAllQuests {
  quests {
    id
    title
    giver
    exp
    wiki
    objectives {
      type
      target
      number
      gps {
        leftPercent
        topPercent
        floor
      }
    }
  }
}`,
  singleQuest: `query FetchSingleQuest {
  quest(id: 1) {
    id
    title
    exp
    giver
    turnin
    wiki
    require {
      level
      quests
    }
    reputation {
      trader
      rep
    }
    objectives {
      type
      target
      number
    }
  }
}`,
  questsByTrader: `query FetchQuestsByTrader {
  questsByTrader(trader: 0) {
    id
    title
    exp
    wiki
    objectives {
      type
      target
      number
    }
  }
}`
};

async function checkStatus() {
  const dot = document.getElementById('status-dot');
  if (!dot) return;
  try {
    const res = await fetch('https://status.tarkovlab.org/api/status-page/heartbeat/tarkovlab');
    if (!res.ok) {
      dot.className = 'footer-status-dot orange';
      return;
    }
    const data = await res.json();
    const heartbeats = data.heartbeatList;
    if (!heartbeats) {
      dot.className = 'footer-status-dot orange';
      return;
    }
    let allUp = true;
    let anyDown = false;
    for (const id in heartbeats) {
      const beats = heartbeats[id];
      if (beats && beats.length > 0) {
        const latest = beats[beats.length - 1];
        if (latest.status === 0) {
          anyDown = true;
          allUp = false;
        } else if (latest.status !== 1) {
          allUp = false;
        }
      }
    }
    if (allUp) {
      dot.className = 'footer-status-dot green';
    } else if (anyDown) {
      dot.className = 'footer-status-dot red';
    } else {
      dot.className = 'footer-status-dot orange';
    }
  } catch {
    dot.className = 'footer-status-dot red';
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  initEditor();
  queryEditor.setValue(queryPresets.allQuests);
  initTheme();
  buildExplorerTree();
  buildCommandsModal();
  checkStatus();

  await fetchAllQuestsFromServer();

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

async function fetchAllQuestsFromServer() {
  const query = `query {
    quests {
      id
      title
      wiki
      exp
      giver
      turnin
      gameId
      require {
        level
        quests
      }
      unlocks
      reputation {
        trader
        rep
      }
      objectives {
        id
        type
        target
        number
        location
        gps {
          leftPercent
          topPercent
          floor
        }
      }
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
    if (result.data && result.data.quests) {
      allQuests = result.data.quests;
      totalPackets += 1;
      document.getElementById('packets-count').textContent = totalPackets;
    }
  } catch (err) {
    console.error("Failed to load quests database:", err);
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
  if (typeName === 'Query' || typeName === 'Quest') {
    loadQueryPreset('allQuests');
  } else if (typeName === 'GPS') {
    queryEditor.setValue(`query FetchGPSPositions {
  quests {
    title
    objectives {
      target
      gps {
        leftPercent
        topPercent
        floor
      }
    }
  }
}`);
  } else if (typeName === 'Reputation') {
    queryEditor.setValue(`query FetchReputations {
  quests {
    title
    reputation {
      trader
      rep
    }
  }
}`);
  } else {
    queryEditor.setValue(`query FetchQuestDetails {
  quests {
    id
    title
    objectives {
      type
      target
    }
  }
}`);
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
    title: 'Fetch all quests',
    desc: 'Basic query returning the full task ledger with minimal fields.',
    query: `{\n  quests {\n    id\n    title\n  }\n}`
  },
  {
    title: 'Fetch a single quest by ID',
    desc: 'Use the quest(id: Int!) field to target one task.',
    query: `{\n  quest(id: 1) {\n    title\n    exp\n    giver\n  }\n}`
  },
  {
    title: 'Filter quests by trader',
    desc: 'questsByTrader accepts a trader index from 0 (Prapor) to 7 (Fence).',
    query: `{\n  questsByTrader(trader: 0) {\n    title\n    exp\n  }\n}`
  },
  {
    title: 'Nested objective fields',
    desc: 'Traverse into objectives and their GPS coordinates in one call.',
    query: `{\n  quests {\n    title\n    objectives {\n      type\n      target\n      gps {\n        leftPercent\n        topPercent\n        floor\n      }\n    }\n  }\n}`
  },
  {
    title: 'Named query & field alias',
    desc: 'Name your operation and rename a field in the response with an alias.',
    query: `query MyQuests {\n  quests {\n    questTitle: title\n    xp: exp\n  }\n}`
  },
  {
    title: 'Reputation rewards only',
    desc: 'Pull just the standing changes each quest grants.',
    query: `{\n  quests {\n    title\n    reputation {\n      trader\n      rep\n    }\n  }\n}`
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
  document.getElementById('explorer-tree').innerHTML = buildExplorerFieldsHTML('Quest', '', 0);
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
  document.getElementById('explorer-id-input').classList.toggle('d-none', op !== 'quest');
  document.getElementById('explorer-trader-input').classList.toggle('d-none', op !== 'questsByTrader');
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

  if (op === 'quests') {
    query = `query ExplorerQuery {\n  quests {\n${selectionSet}\n  }\n}`;
  } else if (op === 'quest') {
    const id = document.getElementById('explorer-id-input').value || 1;
    query = `query ExplorerQuery {\n  quest(id: ${id}) {\n${selectionSet}\n  }\n}`;
  } else {
    const trader = document.getElementById('explorer-trader-input').value || 0;
    query = `query ExplorerQuery {\n  questsByTrader(trader: ${trader}) {\n${selectionSet}\n  }\n}`;
  }

  queryEditor.setValue(query);
}
