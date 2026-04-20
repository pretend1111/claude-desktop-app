const fs = require('fs');
const path = require('path');

function normalizeComposioConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return { apiKey: '' };
  }

  return {
    apiKey: typeof config.apiKey === 'string' ? config.apiKey.trim() : '',
  };
}

function readComposioConfig(configPath) {
  try {
    if (!fs.existsSync(configPath)) {
      return normalizeComposioConfig(null);
    }

    return normalizeComposioConfig(JSON.parse(fs.readFileSync(configPath, 'utf8')));
  } catch (_) {
    return normalizeComposioConfig(null);
  }
}

function writeComposioConfig(configPath, config) {
  const normalized = normalizeComposioConfig(config);
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(normalized, null, 2) + '\n');
  return normalized;
}

function getResolvedComposioApiKey({ config, env } = {}) {
  const normalizedConfig = normalizeComposioConfig(config);
  if (normalizedConfig.apiKey) {
    return normalizedConfig.apiKey;
  }

  const primaryEnvKey =
    env && typeof env.COMPOSIO_API_KEY === 'string' ? env.COMPOSIO_API_KEY.trim() : '';
  if (primaryEnvKey) {
    return primaryEnvKey;
  }

  return env && typeof env.COMPOSIO_PROJECT_API_KEY === 'string'
    ? env.COMPOSIO_PROJECT_API_KEY.trim()
    : '';
}

module.exports = {
  getResolvedComposioApiKey,
  normalizeComposioConfig,
  readComposioConfig,
  writeComposioConfig,
};
