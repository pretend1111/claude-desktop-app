const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const chainPath = path.join(__dirname, 'AssistantThinkingChain.tsx');
const mainContentPath = path.join(__dirname, 'MainContent.tsx');

test('assistant thinking chain follows the Figma icon-and-rail architecture', () => {
  assert.ok(
    fs.existsSync(chainPath),
    'AssistantThinkingChain component should exist so the thought timeline architecture is encapsulated instead of inlined in MainContent'
  );

  const chainSource = fs.readFileSync(chainPath, 'utf8');
  const mainContentSource = fs.readFileSync(mainContentPath, 'utf8');

  for (const assetName of [
    'thought-chain-extended-start.svg',
    'thought-chain-step.svg',
    'thought-chain-done.svg',
    'thought-chain-write-preview.svg',
  ]) {
    assert.match(
      chainSource,
      new RegExp(assetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      `AssistantThinkingChain should use the Figma-exported asset ${assetName}`
    );
  }

  assert.match(
    chainSource,
    /const railClassName = 'bg-\[rgba\(31,31,30,0\.15\)\] dark:bg-\[rgba\(248,248,246,0\.18\)\]';/,
    'AssistantThinkingChain should define the thin vertical rail from the Figma thought-chain architecture'
  );

  assert.match(
    chainSource,
    /renderSummaryButton/,
    'AssistantThinkingChain should use a shared summary button structure so compact and extended variants both follow the Figma two-layer architecture'
  );

  assert.match(
    chainSource,
    /renderTimelineEvent/,
    'AssistantThinkingChain should build the chain from reusable timeline rows instead of one-off blocks'
  );

  assert.match(
    chainSource,
    /Show more/,
    'AssistantThinkingChain should keep the expandable long-thinking pattern from the Figma design'
  );

  assert.match(
    chainSource,
    /event\.detail/,
    'AssistantThinkingChain should render expandable detailed thought content from individual events instead of relying on one giant thinking body'
  );

  assert.match(
    chainSource,
    /events\?:/,
    'AssistantThinkingChain should accept typed thought-chain events so direct replies, skills, and web search can render different nodes'
  );

  assert.match(
    chainSource,
    /detail\?:/,
    'AssistantThinkingChain event typing should support detailed reasoning bodies so long real thinking can render node-level expandable content'
  );

  assert.match(
    chainSource,
    /'web_search'/,
    'AssistantThinkingChain should understand a dedicated web-search event type from the Figma search chain'
  );

  assert.match(
    chainSource,
    /'write_preview'/,
    'AssistantThinkingChain should understand a dedicated write-preview event type for file-generation chains'
  );

  assert.match(
    chainSource,
    /results\.map\(/,
    'AssistantThinkingChain should render a web-search result card instead of flattening search into plain text'
  );

  assert.match(
    chainSource,
    /buildPreviewLines/,
    'AssistantThinkingChain should render a preview-card body for write-heavy flows instead of falling back to raw tool rows'
  );

  assert.match(
    chainSource,
    /const thoughtChainIconStyle = \{ width: 15, height: 15 \} as const;/,
    'AssistantThinkingChain should lock the SVG icons to 15px so the thought-chain nodes match the Figma sizing'
  );

  assert.match(
    chainSource,
    /thought-chain-row-enter/,
    'AssistantThinkingChain should animate new thought rows so live tool/search steps feel streamed instead of static'
  );

  assert.match(
    chainSource,
    /TextShimmer|renderShimmerLabel/,
    'AssistantThinkingChain should highlight the currently active row with a shimmer label while the chain is still in flight'
  );

  assert.match(
    chainSource,
    /AssistantActivityIndicator/,
    'AssistantThinkingChain should reuse the shared Claude activity animation for the active bottom status row'
  );

  assert.match(
    chainSource,
    /Anthropic_Serif_Text:Italic/,
    'AssistantThinkingChain should style the animated thought status copy with the Figma serif italic treatment'
  );

  assert.match(
    chainSource,
    /size=\{28\}/,
    'AssistantThinkingChain should render the spark animation at the same 28px size used in the Figma thinking row'
  );

  assert.match(
    chainSource,
    /setAnimatedStatusText|animatedStatusText/,
    'AssistantThinkingChain should keep a dedicated animated thought-status string so the new spark row can stream text instead of swapping instantly'
  );

  assert.match(
    chainSource,
    /renderCompactTimelineEvent/,
    'AssistantThinkingChain should define a dedicated compact timeline row renderer for non-Extended thought chains'
  );

  assert.match(
    chainSource,
    /AssistantThinkingCompactStatus/,
    'AssistantThinkingChain should expose a compact active-status row so non-Extended mode can place the current step below the assistant body like the Figma design'
  );

  assert.match(
    chainSource,
    /hasDetailedEvents|shouldRenderDetailed/,
    'AssistantThinkingChain should choose between compact and detailed rails based on event content instead of directly on the Extended model toggle'
  );

  assert.match(
    mainContentSource,
    /<AssistantThinkingChain/,
    'MainContent should render AssistantThinkingChain instead of hand-rolling the thought block layout inline'
  );
});

test('detailed thinking keeps a static Thought header and leaves the spark animation to the bottom status row', () => {
  const chainSource = fs.readFileSync(chainPath, 'utf8');

  assert.match(
    chainSource,
    /const thoughtHeaderLabel = 'Thought';/,
    'Detailed thought chains should keep a stable Thought header instead of replacing it with the spark animation row'
  );

  assert.match(
    chainSource,
    /hasDetailedEvents \? thoughtHeaderLabel : summary/,
    'The summary button should switch to a static Thought label whenever detailed reasoning text is rendered underneath it'
  );

  assert.doesNotMatch(
    chainSource,
    /const renderAnimatedSparkSummaryButton =/,
    'The spark animation row should stay in the lower active-status area, not take over the top Thought header'
  );
});

test('compact thought chains keep the same summary chevron but must remain actually collapsible', () => {
  const chainSource = fs.readFileSync(chainPath, 'utf8');

  assert.match(
    chainSource,
    /const canToggle = Boolean\(syntheticEvents\?\.length\) && Boolean\(onToggleExpanded\);/,
    'Any thought chain with rendered events should let the summary chevron toggle the rail, not only detailed reasoning blocks'
  );

  assert.match(
    chainSource,
    /if \(syntheticEvents\?\.length && !hasDetailedEvents && !hasRichResultEvents\) \{[\s\S]*const shouldShowEvents = !canToggle \|\| isExpanded;[\s\S]*shouldShowEvents && compactEvents\.length > 0/,
    'Compact thought chains should respect the shared expanded state so the chevron can hide and reveal compact rows too'
  );
});
