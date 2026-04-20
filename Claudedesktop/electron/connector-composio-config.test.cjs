const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  getResolvedComposioApiKey,
  readComposioConfig,
  writeComposioConfig,
} = require('./connector-composio-config.cjs');

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'connector-composio-config-'));
}

test('reads back a stored Composio api key from local config', () => {
  const tempDir = createTempDir();
  const configPath = path.join(tempDir, 'connector-composio.json');

  writeComposioConfig(configPath, { apiKey: 'cmp_local_key' });

  assert.deepEqual(readComposioConfig(configPath), {
    apiKey: 'cmp_local_key',
  });
});

test('local Composio config takes precedence over environment variables', () => {
  const apiKey = getResolvedComposioApiKey({
    config: { apiKey: 'cmp_local_key' },
    env: {
      COMPOSIO_API_KEY: 'cmp_env_key',
      COMPOSIO_PROJECT_API_KEY: 'cmp_project_key',
    },
  });

  assert.equal(apiKey, 'cmp_local_key');
});

test('falls back to environment variables when local Composio config is empty', () => {
  const primaryKey = getResolvedComposioApiKey({
    config: { apiKey: '  ' },
    env: {
      COMPOSIO_API_KEY: 'cmp_env_key',
      COMPOSIO_PROJECT_API_KEY: 'cmp_project_key',
    },
  });

  assert.equal(primaryKey, 'cmp_env_key');

  const projectKey = getResolvedComposioApiKey({
    config: { apiKey: '' },
    env: {
      COMPOSIO_PROJECT_API_KEY: 'cmp_project_key',
    },
  });

  assert.equal(projectKey, 'cmp_project_key');
});
