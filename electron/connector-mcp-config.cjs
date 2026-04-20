const fs = require('fs');
const os = require('os');
const path = require('path');

const INSTALL_PROFILES = {
  figma: {
    connectorIds: ['figma'],
    serverName: 'figma',
    serverConfig: {
      type: 'http',
      url: 'https://mcp.figma.com/mcp',
    },
  },
  notion: {
    connectorIds: ['notion'],
    serverName: 'notion',
    serverConfig: {
      type: 'http',
      url: 'https://mcp.notion.com/mcp',
    },
  },
  linear: {
    connectorIds: ['linear'],
    serverName: 'linear',
    serverConfig: {
      type: 'http',
      url: 'https://mcp.linear.app/mcp',
    },
  },
  atlassian: {
    connectorIds: ['jira', 'confluence'],
    serverName: 'atlassian',
    serverConfig: {
      type: 'http',
      url: 'https://mcp.atlassian.com/v1/mcp',
    },
  },
};

const PROFILES_BY_CONNECTOR = Object.values(INSTALL_PROFILES).reduce((accumulator, profile) => {
  for (const connectorId of profile.connectorIds) {
    accumulator[connectorId] = profile;
  }
  return accumulator;
}, {});

function isTruthy(value) {
  if (typeof value !== 'string') {
    return !!value;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function getOauthConfigSuffix(env) {
  if (env.CLAUDE_CODE_CUSTOM_OAUTH_URL) {
    return '-custom-oauth';
  }

  if (env.USER_TYPE === 'ant') {
    if (isTruthy(env.USE_LOCAL_OAUTH)) {
      return '-local-oauth';
    }
    if (isTruthy(env.USE_STAGING_OAUTH)) {
      return '-staging-oauth';
    }
  }

  return '';
}

function normalizeConfig(config) {
  if (!config || typeof config !== 'object') {
    return { mcpServers: {} };
  }

  const mcpServers =
    config.mcpServers && typeof config.mcpServers === 'object' ? { ...config.mcpServers } : {};

  return { ...config, mcpServers };
}

function getInstallProfile(connectorId) {
  return PROFILES_BY_CONNECTOR[connectorId] || null;
}

function getGlobalConfigFilePath(options = {}) {
  const env = options.env || process.env;
  const existsSync = options.existsSync || fs.existsSync;
  const homeDir = options.homeDir || os.homedir();
  const configRoot = env.CLAUDE_CONFIG_DIR || homeDir;
  const legacyConfigPath = path.join(configRoot, '.config.json');

  if (existsSync(legacyConfigPath)) {
    return legacyConfigPath;
  }

  return path.join(configRoot, `.claude${getOauthConfigSuffix(env)}.json`);
}

function mergeMcpServerConfig(config, serverName, serverConfig) {
  const normalized = normalizeConfig(config);
  return {
    ...normalized,
    mcpServers: {
      ...normalized.mcpServers,
      [serverName]: serverConfig,
    },
  };
}

function removeMcpServerConfig(config, serverName) {
  const normalized = normalizeConfig(config);
  const nextServers = { ...normalized.mcpServers };
  delete nextServers[serverName];
  return {
    ...normalized,
    mcpServers: nextServers,
  };
}

function getManagedConnectorStatuses(config) {
  const normalized = normalizeConfig(config);
  const statuses = {};

  for (const [connectorId, profile] of Object.entries(PROFILES_BY_CONNECTOR)) {
    statuses[connectorId] = {
      installed: normalized.mcpServers[profile.serverName] !== undefined,
      serverName: profile.serverName,
    };
  }

  return statuses;
}

module.exports = {
  getInstallProfile,
  getGlobalConfigFilePath,
  getManagedConnectorStatuses,
  mergeMcpServerConfig,
  removeMcpServerConfig,
};
