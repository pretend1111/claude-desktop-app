const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const providerSettingsPath = path.join(__dirname, 'ProviderSettings.tsx');
const mainContentPath = path.join(__dirname, 'MainContent.tsx');
const apiPath = path.join(__dirname, '..', 'api.ts');

const providerSource = fs.readFileSync(providerSettingsPath, 'utf8');
const mainContentSource = fs.readFileSync(mainContentPath, 'utf8');
const apiSource = fs.readFileSync(apiPath, 'utf8');

test('provider settings sanitizes malformed self-hosted chat model entries before they reach the tier picker', () => {
  assert.match(
    providerSource,
    /normalizeChatModel|sanitizeChatModels|getProviderDisplayName/,
    'ProviderSettings should normalize persisted self-hosted chat model records instead of trusting localStorage blindly'
  );

  assert.match(
    providerSource,
    /if\s*\(!modelId\)\s*continue;/,
    'ProviderSettings should skip blank provider model ids when building allAvailableModels so empty custom rows never leak into chat model tiers'
  );
});

test('provider settings no longer assumes provider names are always present', () => {
  assert.doesNotMatch(
    providerSource,
    /p\.name\.charAt\(0\)/,
    'ProviderSettings should not call charAt on a possibly-missing provider name because malformed bridge data would white-screen self-hosted mode'
  );
});

test('main content sanitizes self-hosted chat_models before building the selector catalog', () => {
  assert.match(
    mainContentSource,
    /sanitizeSelfHostedChatModels/,
    'MainContent should sanitize persisted self-hosted chat_models before building model selector data'
  );

  assert.match(
    mainContentSource,
    /localStorage\.setItem\('chat_models', JSON\.stringify\(chatModels\)\)/,
    'MainContent should write back the cleaned self-hosted chat_models list so existing blank entries self-heal on the next load'
  );

  assert.match(
    mainContentSource,
    /fallback_model:\s*(?:validSelfHostedDefault|availableSelfHostedFallback)/,
    'MainContent should only use a self-hosted fallback_model that actually exists in the current self-hosted catalog'
  );
});

test('provider CRUD helpers reject non-ok bridge responses instead of blindly returning res.json()', () => {
  assert.match(
    apiSource,
    /readJsonWithError|if\s*\(!res\.ok\)\s*throw new Error/,
    'Provider API helpers should surface bridge errors so add-provider failures are visible in the UI'
  );
});

test('provider settings catches edit and delete failures now that provider CRUD throws', () => {
  assert.match(
    providerSource,
    /const \[providerActionError,\s*setProviderActionError\] = useState<string \| null>\(null\);/,
    'ProviderSettings should keep a dedicated error state for edit/delete failures instead of letting event-handler rejections escape'
  );

  assert.match(
    providerSource,
    /const handleUpdate = async \(id: string, updates: Partial<Provider>\) => \{\s*try \{/,
    'ProviderSettings should catch updateProvider failures inside handleUpdate'
  );

  assert.match(
    providerSource,
    /const handleDelete = async \(id: string\) => \{\s*try \{/,
    'ProviderSettings should catch deleteProvider failures inside handleDelete'
  );

  assert.match(
    providerSource,
    /setProviderActionError\(error instanceof Error \? error\.message : '更新供应商失败'\)/,
    'ProviderSettings should surface update failures to the user'
  );

  assert.match(
    providerSource,
    /setProviderActionError\(error instanceof Error \? error\.message : '删除供应商失败'\)/,
    'ProviderSettings should surface delete failures to the user'
  );
});
