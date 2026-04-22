const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const providerSettingsPath = path.join(__dirname, 'ProviderSettings.tsx');
const providerSource = fs.readFileSync(providerSettingsPath, 'utf8');

test('provider settings catches quick-add, update, and delete failures instead of letting event-handler promises escape', () => {
  assert.match(
    providerSource,
    /const\s+\[addError,\s*setAddError\]\s*=\s*useState/,
    'ProviderSettings should keep a visible error state for add-provider failures'
  );

  assert.match(
    providerSource,
    /const\s+\[providerActionError,\s*setProviderActionError\]\s*=\s*useState/,
    'ProviderSettings should keep a visible error state for provider update/delete failures'
  );

  assert.match(
    providerSource,
    /const handleQuickAdd[\s\S]*try\s*\{[\s\S]*await createProvider[\s\S]*catch\s*\(error\)[\s\S]*setAddError/,
    'ProviderSettings should wrap provider creation in try/catch and surface bridge failures'
  );

  assert.match(
    providerSource,
    /const handleUpdate[\s\S]*try\s*\{[\s\S]*await updateProvider[\s\S]*catch\s*\(error\)[\s\S]*setProviderActionError/,
    'ProviderSettings should wrap provider updates in try/catch and surface the error to the UI'
  );

  assert.match(
    providerSource,
    /const handleDelete[\s\S]*try\s*\{[\s\S]*await deleteProvider[\s\S]*catch\s*\(error\)[\s\S]*setProviderActionError/,
    'ProviderSettings should wrap provider deletes in try/catch and surface the error to the UI'
  );
});
