const fs = require('fs');

const COMPOSIO_API_BASE = 'https://backend.composio.dev';
const COMPOSIO_SERVER_NAME = 'composio';

const COMPOSIO_CONNECTOR_PROFILES = {
  github: { connectorId: 'github', toolkitSlug: 'github' },
  'google-drive': { connectorId: 'google-drive', toolkitSlug: 'googledrive' },
  gmail: { connectorId: 'gmail', toolkitSlug: 'gmail' },
  'google-calendar': { connectorId: 'google-calendar', toolkitSlug: 'googlecalendar' },
  slack: { connectorId: 'slack', toolkitSlug: 'slack' },
  notion: { connectorId: 'notion', toolkitSlug: 'notion' },
  jira: { connectorId: 'jira', toolkitSlug: 'jira' },
  confluence: { connectorId: 'confluence', toolkitSlug: 'confluence' },
  linear: { connectorId: 'linear', toolkitSlug: 'linear' },
  airtable: { connectorId: 'airtable', toolkitSlug: 'airtable' },
  asana: { connectorId: 'asana', toolkitSlug: 'asana' },
  'microsoft-teams': { connectorId: 'microsoft-teams', toolkitSlug: 'microsoft_teams' },
  onedrive: { connectorId: 'onedrive', toolkitSlug: 'one_drive' },
  figma: { connectorId: 'figma', toolkitSlug: 'figma' },
  zoom: { connectorId: 'zoom', toolkitSlug: 'zoom' },
  dropbox: { connectorId: 'dropbox', toolkitSlug: 'dropbox' },
  box: { connectorId: 'box', toolkitSlug: 'box' },
  salesforce: { connectorId: 'salesforce', toolkitSlug: 'salesforce' },
  hubspot: { connectorId: 'hubspot', toolkitSlug: 'hubspot' },
  intercom: { connectorId: 'intercom', toolkitSlug: 'intercom' },
  miro: { connectorId: 'miro', toolkitSlug: 'miro' },
  monday: { connectorId: 'monday', toolkitSlug: 'monday' },
  trello: { connectorId: 'trello', toolkitSlug: 'trello' },
  zendesk: { connectorId: 'zendesk', toolkitSlug: 'zendesk' },
  gitlab: { connectorId: 'gitlab', toolkitSlug: 'gitlab' },
  bitbucket: { connectorId: 'bitbucket', toolkitSlug: 'bitbucket' },
};

const DEFAULT_CONNECTOR_IDS = [
  'github',
  'google-drive',
  'gmail',
  'google-calendar',
  'google-meet',
  'slack',
  'notion',
  'jira',
  'confluence',
  'linear',
  'airtable',
  'asana',
  'microsoft-teams',
  'onedrive',
  'figma',
  'zoom',
  'chrome',
  'dropbox',
  'box',
  'salesforce',
  'hubspot',
  'intercom',
  'miro',
  'monday',
  'trello',
  'zendesk',
  'gitlab',
  'bitbucket',
];

function normalizeSessionStore(store) {
  if (!store || typeof store !== 'object' || Array.isArray(store)) {
    return {};
  }
  return { ...store };
}

function readComposioSessionStore(storePath) {
  try {
    if (!fs.existsSync(storePath)) {
      return {};
    }

    return normalizeSessionStore(JSON.parse(fs.readFileSync(storePath, 'utf8')));
  } catch (_) {
    return {};
  }
}

function writeComposioSessionStore(storePath, store) {
  fs.writeFileSync(storePath, JSON.stringify(normalizeSessionStore(store), null, 2) + '\n');
}

function getSessionStoreKey(userId) {
  return String(userId || '').trim();
}

function getStoredComposioSession(store, userId) {
  const key = getSessionStoreKey(userId);
  if (!key) {
    return null;
  }

  const normalizedStore = normalizeSessionStore(store);
  const record = normalizedStore[key];
  if (!record || typeof record !== 'object') {
    return null;
  }

  return {
    mcpUrl: typeof record.mcpUrl === 'string' ? record.mcpUrl : null,
    sessionId: typeof record.sessionId === 'string' ? record.sessionId : null,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : null,
    userId: key,
  };
}

function upsertStoredComposioSession(store, userId, session) {
  const key = getSessionStoreKey(userId);
  if (!key) {
    throw new Error('Composio session requires a stable user id');
  }

  return {
    ...normalizeSessionStore(store),
    [key]: {
      sessionId: session.sessionId,
      mcpUrl: session.mcpUrl,
      updatedAt: new Date().toISOString(),
    },
  };
}

function getComposioProfile(connectorId) {
  return COMPOSIO_CONNECTOR_PROFILES[connectorId] || null;
}

function listComposioConnectorIds() {
  return Object.keys(COMPOSIO_CONNECTOR_PROFILES);
}

function listComposioToolkitSlugs() {
  return listComposioConnectorIds().map((connectorId) => COMPOSIO_CONNECTOR_PROFILES[connectorId].toolkitSlug);
}

function buildComposioHeaders(apiKey) {
  if (!apiKey) {
    throw new Error('Missing COMPOSIO_API_KEY');
  }

  return {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
  };
}

function buildComposioServerConfig({ apiKey, sessionUrl }) {
  if (!sessionUrl) {
    throw new Error('Missing Composio MCP session URL');
  }

  return {
    type: 'http',
    url: sessionUrl,
    headers: {
      'x-api-key': apiKey,
    },
  };
}

function normalizeConfig(config) {
  if (!config || typeof config !== 'object') {
    return { mcpServers: {} };
  }

  const mcpServers =
    config.mcpServers && typeof config.mcpServers === 'object' ? { ...config.mcpServers } : {};

  return { ...config, mcpServers };
}

function hasInstalledComposioServer(config) {
  const normalized = normalizeConfig(config);
  return Boolean(normalized.mcpServers[COMPOSIO_SERVER_NAME]);
}

function isConnectedAccountActive(connectedAccount) {
  if (!connectedAccount || typeof connectedAccount !== 'object') {
    return false;
  }

  const status = String(connectedAccount.status || '').trim().toLowerCase();
  if (!status) {
    return Boolean(connectedAccount.id);
  }

  return ['active', 'connected', 'enabled', 'authorized', 'authenticated'].includes(status);
}

function getComposioConnectorStatuses({
  config,
  connectorIds = DEFAULT_CONNECTOR_IDS,
  toolkitItems = [],
} = {}) {
  const installed = hasInstalledComposioServer(config);
  const toolkitStatusBySlug = new Map();

  for (const toolkit of toolkitItems) {
    if (!toolkit || typeof toolkit !== 'object') {
      continue;
    }

    const slug = String(toolkit.slug || '').trim().toLowerCase();
    if (!slug) {
      continue;
    }

    toolkitStatusBySlug.set(slug, toolkit);
  }

  return connectorIds.reduce((accumulator, connectorId) => {
    const profile = getComposioProfile(connectorId);
    const toolkit = profile ? toolkitStatusBySlug.get(profile.toolkitSlug) : null;
    const connectedAccount = toolkit && toolkit.connected_account ? toolkit.connected_account : null;

    accumulator[connectorId] = {
      available: Boolean(profile),
      connected: isConnectedAccountActive(connectedAccount),
      connectedAccountId: connectedAccount && connectedAccount.id ? connectedAccount.id : null,
      installed: installed && Boolean(profile),
      serverName: installed && profile ? COMPOSIO_SERVER_NAME : null,
      toolkitSlug: profile ? profile.toolkitSlug : null,
    };

    return accumulator;
  }, {});
}

async function composioRequest(path, { apiKey, body, method = 'GET', query } = {}) {
  const url = new URL(path, COMPOSIO_API_BASE);

  if (query && typeof query === 'object') {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') {
        continue;
      }

      if (Array.isArray(value)) {
        if (value.length > 0) {
          url.searchParams.set(key, value.join(','));
        }
        continue;
      }

      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    method,
    headers: buildComposioHeaders(apiKey),
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMessage =
      payload?.error?.message ||
      payload?.error ||
      `Composio request failed: ${response.status}`;

    const error = new Error(errorMessage);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

async function createComposioSession({ apiKey, toolkitSlugs, userId }) {
  const payload = await composioRequest('/api/v3/tool_router/session', {
    apiKey,
    body: {
      toolkits: toolkitSlugs && toolkitSlugs.length > 0 ? { enable: toolkitSlugs } : undefined,
      user_id: userId,
    },
    method: 'POST',
  });

  return {
    mcpUrl: payload?.mcp?.url || null,
    sessionId: payload?.session_id || null,
  };
}

async function getComposioSession({ apiKey, sessionId }) {
  const payload = await composioRequest(`/api/v3/tool_router/session/${sessionId}`, {
    apiKey,
  });

  return {
    mcpUrl: payload?.mcp?.url || null,
    payload,
    sessionId: payload?.session_id || sessionId,
  };
}

async function getComposioToolkits({ apiKey, sessionId, toolkitSlugs }) {
  const payload = await composioRequest(`/api/v3.1/tool_router/session/${sessionId}/toolkits`, {
    apiKey,
    query: toolkitSlugs && toolkitSlugs.length > 0 ? { toolkits: toolkitSlugs } : undefined,
  });

  return Array.isArray(payload?.items) ? payload.items : [];
}

async function createComposioLink({ alias, apiKey, callbackUrl, sessionId, toolkitSlug }) {
  return composioRequest(`/api/v3.1/tool_router/session/${sessionId}/link`, {
    apiKey,
    body: {
      alias,
      callback_url: callbackUrl,
      toolkit: toolkitSlug,
    },
    method: 'POST',
  });
}

module.exports = {
  COMPOSIO_API_BASE,
  COMPOSIO_SERVER_NAME,
  buildComposioServerConfig,
  createComposioLink,
  createComposioSession,
  getComposioConnectorStatuses,
  getComposioProfile,
  getComposioSession,
  getComposioToolkits,
  getStoredComposioSession,
  hasInstalledComposioServer,
  listComposioConnectorIds,
  listComposioToolkitSlugs,
  readComposioSessionStore,
  upsertStoredComposioSession,
  writeComposioSessionStore,
};
