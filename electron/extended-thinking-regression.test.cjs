const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const bridgePath = path.join(__dirname, 'bridge-server.cjs');

test('bridge preserves extended thinking intent when spawning chat engines', () => {
  const source = fs.readFileSync(bridgePath, 'utf8');

  assert.match(
    source,
    /const rawModel = conv\.model \|\| 'claude-sonnet-4-6';/,
    'bridge should still read the raw stored model string before normalizing it'
  );

  assert.match(
    source,
    /thinkingEnabled/,
    'chat config should explicitly track whether extended thinking is enabled instead of relying only on a stripped model id'
  );

  assert.match(
    source,
    /--thinking',\s*config\.thinkingEnabled \? 'enabled' : 'disabled'/,
    'engine spawns should forward extended thinking mode to the Claude engine CLI'
  );

  assert.match(
    source,
    /const incompatibleThinkingToolModel = \/qwen\|glm\|deepseek\|minimax\/i\.test/,
    'openai proxy should only disable thinking+tools for known incompatible model families instead of blanket-disabling extended thinking for every self-hosted openai provider'
  );

  assert.match(
    source,
    /const \{ mergeToolArgs, computeToolArgDelta \} = require\('\.\/tool-arg-stream-utils\.cjs'\);/,
    'openai proxy should use shared helpers to merge self-hosted tool argument snapshots without corrupting cumulative JSON updates'
  );

  assert.match(
    source,
    /const ensureLiveToolBlock = \(ptc\) =>/,
    'openai proxy should open tool_use content blocks before the upstream stream finishes so thought-chain rows can appear live'
  );

  assert.match(
    source,
    /else if \(tu\.input && Object\.keys\(tu\.input\)\.length > 0\)\s*\{\s*sendSSE\(\{ type: 'tool_use_input'/,
    'replayed tool_use starts with finalized input should update the existing frontend row instead of enqueueing a duplicate start'
  );

  assert.match(
    source,
    /const HIDDEN_TOOLS = new Set\(\['EnterWorktree', 'ExitWorktree', 'TodoWrite'\]\);/,
    'bridge should no longer hide WebSearch/WebFetch from frontend tool events, because the thought-chain UI depends on those live events'
  );
});

test('bridge persists each turn model so historical messages keep their original thought-chain mode', () => {
  const source = fs.readFileSync(bridgePath, 'utf8');

  assert.match(
    source,
    /db\.messages\.push\(\{\s*id: userMsgUuid,\s*conversation_id,\s*role: 'user',[\s\S]*model: conv\.model,/,
    'user turns should store the conversation model snapshot that was active when the turn was sent'
  );

  assert.match(
    source,
    /db\.messages\.push\(\{ id: turn\.assistantUuid \|\| uuidv4\(\),[\s\S]*model: conv\.model,/,
    'assistant turns should store the generation model so toggling Extended later cannot reclassify old messages'
  );
});
