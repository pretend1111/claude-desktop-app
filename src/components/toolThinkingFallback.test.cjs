const test = require('node:test');
const assert = require('node:assert/strict');

async function loadModule() {
  return import('./toolThinkingFallback.js');
}

test('buildToolFallbackThinking summarizes visible tool calls into thought-chain text', async () => {
  const { buildToolFallbackThinking } = await loadModule();

  const result = buildToolFallbackThinking([
    { name: 'Bash', input: { command: 'ls -la' } },
    { name: 'Write', input: { file_path: '/tmp/index.html' } },
  ]);

  assert.equal(result.summary, 'Run command, Write file');
  assert.equal(result.thinking, 'Run command: ls -la\nWrite file: index.html');
  assert.ok(Array.isArray(result.events), 'tool fallback should expose typed chain events');
  assert.deepEqual(
    result.events.map((event) => ({ kind: event.kind, label: event.label })),
    [
      { kind: 'tool', label: 'Run command: ls -la' },
      { kind: 'tool', label: 'Write file: index.html' },
    ]
  );
});

test('buildResponseFallbackThinking creates a direct-response thought summary when provider emits no reasoning', async () => {
  const { buildResponseFallbackThinking } = await loadModule();

  const result = buildResponseFallbackThinking('你好！很高兴见到你。有什么我可以帮忙的吗？');

  assert.equal(result.summary, 'Responding directly');
  assert.equal(result.thinking, 'Preparing a direct reply\nFocus: 你好！很高兴见到你。');
  assert.deepEqual(
    result.events,
    [
      { kind: 'direct', label: 'Preparing a direct reply' },
      { kind: 'focus', label: 'Focus: 你好！很高兴见到你。' },
    ]
  );
});

test('buildResponseFallbackThinking does not fabricate a thought chain for error text', async () => {
  const { buildResponseFallbackThinking } = await loadModule();

  const result = buildResponseFallbackThinking('Error: Failed to create conversation. Failed to fetch');

  assert.equal(
    result,
    null,
    'error messages should bypass synthetic thought-chain fallback entirely'
  );
});

test('buildToolFallbackThinking turns skill invocations into a skill-specific chain node', async () => {
  const { buildToolFallbackThinking } = await loadModule();

  const result = buildToolFallbackThinking([
    { name: 'Skill', input: { skill: 'frontend-design' }, result: 'Reading frontend-design SKILL.md' },
  ]);

  assert.equal(result.summary, 'Reading frontend design skill');
  assert.equal(result.thinking, 'Reading frontend design skill');
  assert.deepEqual(result.events, [{ kind: 'skill', label: 'Reading frontend design skill' }]);
});

test('buildToolFallbackThinking turns WebSearch into a dedicated search node with result previews', async () => {
  const { buildToolFallbackThinking } = await loadModule();

  const result = buildToolFallbackThinking([
    {
      name: 'WebSearch',
      input: { query: 'Codex computer use' },
      result:
        'query: "Codex computer use"\n' +
        'Links: ' +
        JSON.stringify([
          { title: 'Computer Use – Codex app | OpenAI Developers', url: 'https://developers.openai.com/codex/computer-use' },
          { title: 'Codex for (almost) everything | OpenAI', url: 'https://openai.com/index/codex/' },
          { title: 'Introducing GPT-5.4 | OpenAI', url: 'https://openai.com/index/introducing-gpt-5-4/' },
        ]) +
        '\n',
    },
  ]);

  assert.equal(result.summary, 'Searched the web');
  assert.equal(result.thinking, 'Codex computer use');
  assert.deepEqual(result.events, [
    {
      kind: 'web_search',
      label: 'Codex computer use',
      meta: '3 results',
      results: [
        {
          title: 'Computer Use – Codex app | OpenAI Developers',
          source: 'developers.openai.com',
          url: 'https://developers.openai.com/codex/computer-use',
        },
        {
          title: 'Codex for (almost) everything | OpenAI',
          source: 'openai.com',
          url: 'https://openai.com/index/codex/',
        },
        {
          title: 'Introducing GPT-5.4 | OpenAI',
          source: 'openai.com',
          url: 'https://openai.com/index/introducing-gpt-5-4/',
        },
      ],
    },
  ]);
});

test('buildToolFallbackThinking can surface streamed search_sources before WebSearch finishes', async () => {
  const { buildToolFallbackThinking } = await loadModule();

  const result = buildToolFallbackThinking(
    [
      {
        name: 'WebSearch',
        input: { query: 'Claude Desktop thinking chain' },
        status: 'running',
      },
    ],
    {
      searchLogs: [
        {
          query: 'Claude Desktop thinking chain',
          results: [
            {
              title: 'Claude Desktop engineering notes',
              url: 'https://notes.example.com/claude-desktop-thinking-chain',
            },
            {
              title: 'Thinking chain design review',
              url: 'https://figma.example.com/thinking-chain',
            },
          ],
        },
      ],
    }
  );

  assert.equal(result.summary, 'Searched the web');
  assert.equal(result.thinking, 'Claude Desktop thinking chain');
  assert.deepEqual(result.events, [
    {
      kind: 'web_search',
      label: 'Claude Desktop thinking chain',
      meta: '2 results',
      results: [
        {
          title: 'Claude Desktop engineering notes',
          source: 'notes.example.com',
          url: 'https://notes.example.com/claude-desktop-thinking-chain',
        },
        {
          title: 'Thinking chain design review',
          source: 'figma.example.com',
          url: 'https://figma.example.com/thinking-chain',
        },
      ],
    },
  ]);
});

test('buildToolFallbackThinking can surface a live search row before WebSearch emits a full tool call', async () => {
  const { buildToolFallbackThinking } = await loadModule();

  const result = buildToolFallbackThinking([], {
    searchStatus: 'Searching: 21st sdk search tool',
    searchLogs: [
      {
        query: '21st sdk search tool',
        results: [
          { title: '21st search tool docs', url: 'https://21st.dev/docs/search-tool' },
        ],
      },
    ],
  });

  assert.equal(result.summary, 'Searched the web');
  assert.equal(result.thinking, '21st sdk search tool');
  assert.deepEqual(result.events, [
    {
      kind: 'web_search',
      label: '21st sdk search tool',
      meta: '1 results',
      results: [
        {
          title: '21st search tool docs',
          source: '21st.dev',
          url: 'https://21st.dev/docs/search-tool',
        },
      ],
    },
  ]);
});

test('buildToolFallbackThinking turns curl-based research steps into website visit cards', async () => {
  const { buildToolFallbackThinking } = await loadModule();

  const result = buildToolFallbackThinking([
    {
      name: 'Bash',
      status: 'running',
      input: {
        command:
          'curl -s "https://api.github.com/repos/21st-dev/21st-sdk/contents/packages/react/src/tools/search-tool.tsx" && ' +
          'curl -s "https://raw.githubusercontent.com/21st-dev/21st-sdk/main/packages/react/src/tools/search-tool.tsx"',
      },
    },
  ]);

  assert.equal(result.summary, 'Searched the web');
  assert.equal(result.thinking, 'Visiting 2 sites');
  assert.deepEqual(result.events, [
    {
      kind: 'web_search',
      label: 'Visiting 2 sites',
      meta: 'Fetching',
      results: [
        {
          title: 'api.github.com / repos/21st-dev/21st-sdk/contents',
          source: 'api.github.com',
          url: 'https://api.github.com/repos/21st-dev/21st-sdk/contents/packages/react/src/tools/search-tool.tsx',
        },
        {
          title: 'raw.githubusercontent.com / 21st-dev/21st-sdk/main/packages',
          source: 'raw.githubusercontent.com',
          url: 'https://raw.githubusercontent.com/21st-dev/21st-sdk/main/packages/react/src/tools/search-tool.tsx',
        },
      ],
    },
  ]);
});

test('buildToolFallbackThinking condenses write-heavy flows into a preview event', async () => {
  const { buildToolFallbackThinking } = await loadModule();

  const result = buildToolFallbackThinking(
    [
      { name: 'Skill', input: { skill: 'frontend-design' } },
      { name: 'Bash', input: { command: 'ls -la' } },
      {
        name: 'Write',
        input: {
          file_path: '/tmp/index.html',
          content: '<!DOCTYPE html>\n<html>\n  <body>\n    <h1>Claude Writing Assistant</h1>\n  </body>\n</html>',
        },
      },
      {
        name: 'Write',
        input: {
          file_path: '/tmp/styles.css',
          content: 'body { background: #f8f8f6; }',
        },
      },
    ],
    { summaryHint: 'I’ll create a polished interactive writing assistant.' }
  );

  assert.equal(result.summary, 'I’ll create a polished interactive writing assistant.');
  assert.deepEqual(
    result.events,
    [
      { kind: 'skill', label: 'Reading frontend design skill' },
      {
        kind: 'write_preview',
        label: 'Create the project files',
        meta: '2 files',
        preview: {
          title: 'index.html',
          format: 'html',
          content: '<!DOCTYPE html>\n<html>\n  <body>\n    <h1>Claude Writing Assistant</h1>\n  </body>\n</html>',
        },
      },
    ]
  );
});

test('buildReasoningTimelineEvents turns long real reasoning into detailed rail events without relying on Extended UI mode', async () => {
  const { buildReasoningTimelineEvents } = await loadModule();

  const result = buildReasoningTimelineEvents(
    [
      'The user wants me to create an interactive text editor that:',
      '',
      '- Takes user input',
      '- Uses the Claude API to suggest improvements',
      '- Should look professional and polished',
      '',
      'Let me start by reading the frontend-design skill to get the right approach.',
      '',
      'Perfect. Now I understand the frontend design principles I should follow.',
      '',
      '- Use a bold, intentional aesthetic',
      '- Choose distinctive typography',
      '- Keep the layout polished and spacious',
    ].join('\n'),
    {
      summaryHint: 'Architected sophisticated text editor with API integration and refined design system',
      toolCalls: [
        { name: 'Skill', input: { skill: 'frontend-design' }, status: 'done' },
      ],
      isThinking: false,
    }
  );

  assert.equal(result.summary, 'Architected sophisticated text editor with API integration and refined design system');
  assert.deepEqual(
    result.events.map((event) => ({
      kind: event.kind,
      label: event.label,
      hasDetail: typeof event.detail === 'string' && event.detail.length > 0,
    })),
    [
      {
        kind: 'focus',
        label: 'The user wants me to create an interactive text editor that:',
        hasDetail: true,
      },
      {
        kind: 'skill',
        label: 'Reading frontend design skill',
        hasDetail: false,
      },
      {
        kind: 'focus',
        label: 'Perfect. Now I understand the frontend design principles I should follow.',
        hasDetail: true,
      },
      {
        kind: 'done',
        label: 'Done',
        hasDetail: false,
      },
    ]
  );
});

test('buildReasoningTimelineEvents keeps short real reasoning as visible thought text instead of collapsing it into a status line', async () => {
  const { buildReasoningTimelineEvents } = await loadModule();

  const result = buildReasoningTimelineEvents(
    'The user wants a quick summary of the React search tool before I inspect the file.',
    {
      toolCalls: [
        {
          name: 'WebSearch',
          input: { query: '21st-dev/21st-sdk packages/react/src/tools/search-tool.tsx' },
          status: 'running',
        },
      ],
      isThinking: true,
    }
  );

  assert.equal(result.hasDetailedEvents, true);
  assert.equal(
    result.events[0]?.detail,
    'The user wants a quick summary of the React search tool before I inspect the file.'
  );
});
