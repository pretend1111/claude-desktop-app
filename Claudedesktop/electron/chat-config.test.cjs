const test = require('node:test');
const assert = require('node:assert/strict');

const {
  resolveRequestedModelForMode,
} = require('./chat-config.cjs');

test('falls back to Claude when clawparrot receives a non-Claude model', () => {
  const result = resolveRequestedModelForMode({
    modelId: 'gpt-5.4',
    userMode: 'clawparrot',
    hasProvider: true,
  });

  assert.equal(result.modelId, 'claude-sonnet-4-6');
  assert.equal(result.fallbackApplied, true);
  assert.equal(result.error, null);
});

test('keeps Claude models unchanged in clawparrot mode', () => {
  const result = resolveRequestedModelForMode({
    modelId: 'claude-sonnet-4-6',
    userMode: 'clawparrot',
    hasProvider: false,
  });

  assert.equal(result.modelId, 'claude-sonnet-4-6');
  assert.equal(result.fallbackApplied, false);
  assert.equal(result.error, null);
});

test('fails fast when selfhosted mode lacks a provider for a non-Claude model', () => {
  const result = resolveRequestedModelForMode({
    modelId: 'gemini-3.1-pro-preview',
    userMode: 'selfhosted',
    hasProvider: false,
  });

  assert.equal(result.modelId, 'gemini-3.1-pro-preview');
  assert.equal(result.fallbackApplied, false);
  assert.match(result.error, /No enabled self-hosted provider/i);
});
