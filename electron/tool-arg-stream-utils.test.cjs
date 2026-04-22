const test = require('node:test');
const assert = require('node:assert/strict');

const {
  mergeToolArgs,
  computeToolArgDelta,
  tryParseToolArgsObject,
} = require('./tool-arg-stream-utils.cjs');

test('mergeToolArgs replaces full cumulative JSON snapshots instead of concatenating them', () => {
  assert.equal(
    mergeToolArgs('{"query":"a"}', '{"query":"ab"}'),
    '{"query":"ab"}'
  );
});

test('mergeToolArgs still appends genuine streaming fragments', () => {
  assert.equal(
    mergeToolArgs('{"query":"', 'ab"}'),
    '{"query":"ab"}'
  );
});

test('computeToolArgDelta only returns append-only suffixes', () => {
  assert.equal(
    computeToolArgDelta('{"query":"a', '{"query":"ab"}'),
    'b"}'
  );

  assert.equal(
    computeToolArgDelta('{"query":"a"}', '{"query":"ab"}'),
    null
  );
});

test('tryParseToolArgsObject only accepts complete JSON objects', () => {
  assert.deepEqual(tryParseToolArgsObject('{"query":"ab"}'), { query: 'ab' });
  assert.equal(tryParseToolArgsObject('{"query":"ab"'), null);
  assert.equal(tryParseToolArgsObject('"ab"'), null);
});
