const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildComposioServerConfig,
  createComposioSession,
  getComposioProfile,
  getComposioConnectorStatuses,
} = require('./connector-composio.cjs');

test('known connectors resolve to Composio toolkit profiles', () => {
  const github = getComposioProfile('github');
  const drive = getComposioProfile('google-drive');
  const teams = getComposioProfile('microsoft-teams');
  const onedrive = getComposioProfile('onedrive');
  const unsupported = getComposioProfile('google-meet');

  assert.ok(github, 'expected GitHub to have a Composio profile');
  assert.ok(drive, 'expected Google Drive to have a Composio profile');
  assert.equal(github.toolkitSlug, 'github');
  assert.equal(drive.toolkitSlug, 'googledrive');
  assert.equal(teams.toolkitSlug, 'microsoft_teams');
  assert.equal(onedrive.toolkitSlug, 'one_drive');
  assert.equal(unsupported, null);
});

test('Composio MCP server config includes required api key header', () => {
  const config = buildComposioServerConfig({
    apiKey: 'cmp_test_key',
    sessionUrl: 'https://app.composio.dev/tool_router/v3/trs_123/mcp',
  });

  assert.deepEqual(config, {
    type: 'http',
    url: 'https://app.composio.dev/tool_router/v3/trs_123/mcp',
    headers: {
      'x-api-key': 'cmp_test_key',
    },
  });
});

test('Composio status mapping distinguishes installed and connected states', () => {
  const statuses = getComposioConnectorStatuses({
    config: {
      mcpServers: {
        composio: {
          type: 'http',
          url: 'https://app.composio.dev/tool_router/v3/trs_123/mcp',
          headers: {
            'x-api-key': 'cmp_test_key',
          },
        },
      },
    },
    toolkitItems: [
      {
        slug: 'github',
        connected_account: {
          id: 'ca_github',
          status: 'ACTIVE',
        },
      },
      {
        slug: 'slack',
        connected_account: null,
      },
    ],
  });

  assert.equal(statuses.github.available, true);
  assert.equal(statuses.github.installed, true);
  assert.equal(statuses.github.connected, true);
  assert.equal(statuses.github.connectedAccountId, 'ca_github');

  assert.equal(statuses.slack.available, true);
  assert.equal(statuses.slack.installed, true);
  assert.equal(statuses.slack.connected, false);

  assert.equal(statuses.notion.available, true);
  assert.equal(statuses.notion.installed, true);
  assert.equal(statuses.notion.connected, false);

  assert.equal(statuses['google-meet'].available, false);
  assert.equal(statuses['google-meet'].installed, false);
  assert.equal(statuses['google-meet'].connected, false);
});

test('Composio session creation uses the current toolkits.enable payload shape', async () => {
  const originalFetch = global.fetch;
  const fetchCalls = [];

  global.fetch = async (url, options = {}) => {
    fetchCalls.push({
      options,
      url: String(url),
    });

    return {
      ok: true,
      json: async () => ({
        mcp: {
          url: 'https://app.composio.dev/tool_router/v3/trs_123/mcp',
        },
        session_id: 'trs_123',
      }),
    };
  };

  try {
    const session = await createComposioSession({
      apiKey: 'cmp_test_key',
      toolkitSlugs: ['notion', 'slack'],
      userId: 'desktop-local-user',
    });

    assert.equal(session.sessionId, 'trs_123');
    assert.equal(session.mcpUrl, 'https://app.composio.dev/tool_router/v3/trs_123/mcp');
    assert.equal(fetchCalls.length, 1);

    const request = fetchCalls[0];
    assert.equal(request.url, 'https://backend.composio.dev/api/v3/tool_router/session');

    const body = JSON.parse(request.options.body);
    assert.deepEqual(body, {
      toolkits: {
        enable: ['notion', 'slack'],
      },
      user_id: 'desktop-local-user',
    });
  } finally {
    global.fetch = originalFetch;
  }
});
