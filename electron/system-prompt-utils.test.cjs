const test = require('node:test');
const assert = require('node:assert/strict');

const { buildSelfHostedSystemPrompt } = require('./system-prompt-utils.cjs');

test('buildSelfHostedSystemPrompt preserves chat style but replaces Claude-specific identity', () => {
  const fullPrompt = `
<identity>
You are Claude, created by Anthropic.
Treat the user the way you would on claude.ai: with warmth, curiosity, presence, and depth.
Default to 简体中文 when the user writes in Chinese.
</identity>

<rules>
Keep responses safe.
</rules>
`.trim();

  const cleaned = buildSelfHostedSystemPrompt(fullPrompt);

  assert.doesNotMatch(
    cleaned,
    /You are Claude, created by Anthropic\./,
    'self-hosted prompt should not keep Claude-specific identity claims'
  );

  assert.match(
    cleaned,
    /running in a desktop application called Claude Desktop/,
    'self-hosted prompt should keep the Claude Desktop product context'
  );

  assert.match(
    cleaned,
    /Treat the user the way claude\.ai would: with warmth, curiosity, presence, and depth\./,
    'self-hosted prompt should preserve the chat style guidance'
  );

  assert.match(
    cleaned,
    /Default to 简体中文 when the user writes in Chinese\./,
    'self-hosted prompt should preserve language guidance'
  );

  assert.match(
    cleaned,
    /<rules>[\s\S]*Keep responses safe\./,
    'self-hosted prompt should preserve non-identity sections'
  );
});
