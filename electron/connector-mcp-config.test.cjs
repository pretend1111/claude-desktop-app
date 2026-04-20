const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getInstallProfile,
  getManagedConnectorStatuses,
  getGlobalConfigFilePath,
  mergeMcpServerConfig,
  removeMcpServerConfig,
} = require('./connector-mcp-config.cjs');

test('supported connectors expose install profiles', () => {
  const figma = getInstallProfile('figma');
  const notion = getInstallProfile('notion');
  const jira = getInstallProfile('jira');

  assert.ok(figma, 'expected Figma install profile');
  assert.ok(notion, 'expected Notion install profile');
  assert.ok(jira, 'expected Jira install profile');
  assert.equal(figma.serverConfig.type, 'http');
  assert.match(figma.serverConfig.url, /^https:\/\//);
});

test('install profiles can be merged into and removed from MCP config', () => {
  const figma = getInstallProfile('figma');
  assert.ok(figma, 'expected Figma install profile');

  const merged = mergeMcpServerConfig({}, figma.serverName, figma.serverConfig);
  assert.deepEqual(merged.mcpServers[figma.serverName], figma.serverConfig);

  const removed = removeMcpServerConfig(merged, figma.serverName);
  assert.equal(removed.mcpServers[figma.serverName], undefined);
});

test('shared backends report installed status for related connectors', () => {
  const jira = getInstallProfile('jira');
  assert.ok(jira, 'expected Jira install profile');

  const config = mergeMcpServerConfig({}, jira.serverName, jira.serverConfig);
  const statuses = getManagedConnectorStatuses(config);

  assert.equal(statuses.jira.installed, true);
  assert.equal(statuses.confluence.installed, true);
  assert.equal(statuses.notion.installed, false);
});

test('global config path defaults to ~/.claude.json', () => {
  const configPath = getGlobalConfigFilePath({
    env: {},
    existsSync: () => false,
    homeDir: '/Users/tester',
  });

  assert.equal(configPath, '/Users/tester/.claude.json');
});

test('global config path honors CLAUDE_CONFIG_DIR and custom oauth suffix', () => {
  const configPath = getGlobalConfigFilePath({
    env: {
      CLAUDE_CONFIG_DIR: '/tmp/claude-config',
      CLAUDE_CODE_CUSTOM_OAUTH_URL: 'https://example.com/oauth',
    },
    existsSync: () => false,
    homeDir: '/Users/tester',
  });

  assert.equal(configPath, '/tmp/claude-config/.claude-custom-oauth.json');
});

test('global config path preserves legacy .config.json when present', () => {
  const configPath = getGlobalConfigFilePath({
    env: {
      CLAUDE_CONFIG_DIR: '/tmp/claude-config',
    },
    existsSync: (target) => target === '/tmp/claude-config/.config.json',
    homeDir: '/Users/tester',
  });

  assert.equal(configPath, '/tmp/claude-config/.config.json');
});
