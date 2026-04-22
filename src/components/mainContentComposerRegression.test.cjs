const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const mainContentPath = path.join(__dirname, 'MainContent.tsx');
const source = fs.readFileSync(mainContentPath, 'utf8');

function extractBlock(startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  assert.notEqual(start, -1, `Missing start marker: ${startNeedle}`);
  const end = source.indexOf(endNeedle, start);
  assert.notEqual(end, -1, `Missing end marker: ${endNeedle}`);
  return source.slice(start, end);
}

test('landing composer textarea stays readable in dark mode', () => {
  const landingComposerBlock = extractBlock(
    'className={`w-full pl-[6px] pr-0 pt-[4px] pb-0',
    'placeholder={selectedSkill ? `Describe what you want ${selectedSkill.name} to do...` : "How can I help you today?"}'
  );

  assert.match(
    landingComposerBlock,
    /dark:text-claude-text/,
    'landing composer textarea should explicitly set a readable dark-mode text color'
  );

  assert.match(
    landingComposerBlock,
    /dark:placeholder:text-[^`\s}]+/,
    'landing composer textarea should explicitly set a readable dark-mode placeholder color'
  );
});

test('conversation composer plus menu matches landing menu options', () => {
  const sharedPlusMenuBlock = extractBlock(
    'const renderSharedPlusMenu = (shellClass: string, submenuClass: string) => (',
    '// Shared overlays rendered in both MODE 1 and MODE 2'
  );

  for (const expectedItem of [
    'Add files or photos',
    'Take a screenshot',
    'Add to project',
    'Skills',
    'Add connectors',
    'Web search',
    'Use style',
  ]) {
    assert.match(
      sharedPlusMenuBlock,
      new RegExp(expectedItem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      `shared composer plus menu should include "${expectedItem}"`
    );
  }

  for (const removedItem of [
    'Add from GitHub',
    'Compact conversation',
    'Research',
  ]) {
    assert.doesNotMatch(
      sharedPlusMenuBlock,
      new RegExp(removedItem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      `shared composer plus menu should not include "${removedItem}"`
    );
  }

  assert.match(
    source,
    /renderSharedPlusMenu\(conversationPlusMenuShellClass,\s*conversationPlusMenuSubmenuClass\)/,
    'conversation composer should render the shared plus menu instead of a separate menu implementation'
  );
});

test('send buttons define dedicated dark-mode styling', () => {
  const landingSendButtonBlock = extractBlock(
    'const landingSendButtonClass = "',
    'const conversationSendButtonClass = "'
  );

  const conversationSendButtonBlock = extractBlock(
    'const conversationSendButtonClass = "',
    'const renderSharedPlusMenu = (shellClass: string, submenuClass: string) => ('
  );

  for (const [label, block] of [
    ['landing composer send button', landingSendButtonBlock],
    ['conversation composer send button', conversationSendButtonBlock],
  ]) {
    assert.match(block, /dark:bg-\[[^\]]+\]/, `${label} should define a dark-mode background`);
    assert.match(block, /dark:border-[^\s"]+/, `${label} should define a dark-mode border`);
    assert.match(block, /dark:hover:bg-\[[^\]]+\]/, `${label} should define a dark-mode hover background`);
    assert.match(block, /dark:text-\[[^\]]+\]/, `${label} should define a dark-mode icon/text color`);
  }
});

test('assistant done tail indicator gets standalone spacing and 28px size', () => {
  const tailIndicatorBlock = extractBlock(
    'const tailIndicator = (',
    'if (tailPhase === \'done\') {'
  );

  assert.match(
    tailIndicatorBlock,
    /size=\{28\}/,
    'assistant done tail indicator should render at 28px'
  );

  assert.match(
    source,
    /tailPhase === 'done'[\s\S]*className="mt-3 flex items-start"/,
    'assistant done tail indicator should sit in its own block with top spacing'
  );
});

test('extended thinking mode routes tool-heavy assistant turns through thought-chain presentation', () => {
  assert.match(
    source,
    /const messagePresentationModel = resolveMessagePresentationModel\(msg,\s*currentModelString,\s*isStreamingAssistantTurn\);[\s\S]*const shouldUseThinkingModePresentation = isThinkingModel\(messagePresentationModel\);/,
    'assistant message renderer should detect thinking-mode presentation from the message generation model, not directly from the live composer toggle'
  );

  assert.match(
    source,
    /buildReasoningTimelineEvents\(msg\.thinking,/,
    'assistant message renderer should turn long real reasoning into typed rail events instead of leaving it as one opaque thinking blob'
  );

  assert.match(
    source,
    /buildToolFallbackThinking\(msg\.toolCalls,\s*\{[\s\S]*summaryHint:\s*extractToolSummaryHint\(msg\),[\s\S]*searchLogs:\s*msg\.searchLogs[\s\S]*\}\)/,
    'thinking-mode assistant turns should synthesize a live thought chain from tool calls and streamed search results when no native thinking text is available'
  );

  assert.match(
    source,
    /buildResponseFallbackThinking\(extractTextContent\(msg\.content\)\)/,
    'thinking-mode assistant turns without provider reasoning should still synthesize a direct-response thought chain from the final assistant text'
  );

  assert.match(
    source,
    /shouldUseDetailedThinkingPresentation/,
    'MainContent should decide detailed thought rendering from the actual parsed reasoning events, not directly from the Extended model toggle'
  );
});

test('historical assistant turns do not reclassify thought-chain mode from the live composer toggle', () => {
  assert.match(
    source,
    /function resolveMessagePresentationModel\(message: any, currentModelString: string, isStreamingCurrentTurn: boolean\)/,
    'MainContent should define a helper that resolves presentation mode from message-specific generation state'
  );

  const assistantThoughtRenderBlock = extractBlock(
    'const isStreamingAssistantTurn = Boolean(loading && idx === messages.length - 1);',
    'const responseFallbackThinking = !msg.thinking'
  );

  assert.doesNotMatch(
    assistantThoughtRenderBlock,
    /isThinkingModel\(currentModelString\)/,
    'historical assistant messages should not switch into thinking-mode presentation just because the composer toggle changed later'
  );
});

test('non-Extended mode routes tool-heavy turns through compact thought-chain presentation', () => {
  assert.match(
    source,
    /const shouldUseCompactToolPresentation = !shouldUseThinkingModePresentation && Boolean\(/,
    'assistant message renderer should detect non-Extended tool/search turns that should use the compact Figma thought-chain treatment'
  );

  assert.match(
    source,
    /if \(shouldUseThinkingModePresentation \|\| shouldUseCompactToolPresentation\) \{[\s\S]*const fullText = extractTextContent\(msg\.content\);[\s\S]*const offset = msg\.toolTextEndOffset;[\s\S]*const hasOffset = offset && offset > 0 && offset < fullText\.length;[\s\S]*const finalText = hasOffset \? fullText\.slice\(offset\)\.trim\(\) : '';\s*[\s\S]*const isCurrentlyStreaming = loading && idx === messages\.length - 1;[\s\S]*\(msg as any\)\._finalText = shouldUseCompactToolPresentation[\s\S]*\? isCurrentlyStreaming[\s\S]*\? ''[\s\S]*: \(hasOffset \? finalText : fullText\)[\s\S]*: extractTextContent\(msg\.content\);[\s\S]*return null;\s*\}/,
    'legacy raw tool cards should also be suppressed in non-Extended compact mode so they do not compete with the new compact thought chain'
  );

  assert.match(
    source,
    /<AssistantThinkingCompactStatus[\s\S]*event=\{compactActiveEvent\}/,
    'MainContent should render the compact active-status row beneath the assistant body so non-Extended mode matches the Figma layout'
  );

  assert.match(
    source,
    /const compactActiveEvent = \(msg as any\)\._compactActiveEvent;[\s\S]*<AssistantThinkingCompactStatus[\s\S]*label|event=\{compactActiveEvent\}/,
    'MainContent should keep the live activity line anchored below the body so the flower-row status can change as the active step changes'
  );
});

test('compact thought-chain hides in-progress work text from the markdown body until tools finish', () => {
  assert.doesNotMatch(
    source,
    /shouldUseCompactToolPresentation[\s\S]*\(msg as any\)\._finalText = extractTextContent\(msg\.content\);/,
    'compact thought-chain should not dump the full streaming work text back into the markdown body'
  );
});

test('compact thought-chain does not stack the generic tail flower under its own active status row', () => {
  assert.match(
    source,
    /const compactActiveEvent = \(msg as any\)\._compactActiveEvent;[\s\S]*if \(compactActiveEvent && tailPhase !== 'done'\) return null;/,
    'when compact thought-chain is already showing a live flower row, MainContent should suppress the generic tail indicator until completion'
  );
});

test('compact thought-chain keeps an actual expanded state instead of rendering a dead chevron', () => {
  assert.match(
    source,
    /const defaultExpandedState = displayEvents\?\.length[\s\S]*\? true[\s\S]*: shouldUseDetailedThinkingPresentation/,
    'thought chains with visible event rails should default to expanded so the summary chevron can later collapse them'
  );

  assert.match(
    source,
    /const displayIsExpanded = Boolean\([\s\S]*msg\.isThinkingExpanded \?\?[\s\S]*defaultExpandedState[\s\S]*\);/,
    'MainContent should preserve per-message expansion state for compact chains too, not only detailed extended chains'
  );
});

test('message list receives currentModelString explicitly so thinking-mode rendering does not crash at runtime', () => {
  assert.match(
    source,
    /interface MessageListProps \{[\s\S]*currentModelString: string;/,
    'MessageList props should declare currentModelString explicitly'
  );

  assert.match(
    source,
    /const MessageList = React\.memo<MessageListProps>\(\(\{[\s\S]*currentModelString,/,
    'MessageList should destructure currentModelString from props instead of reading an outer-scope variable'
  );

  assert.match(
    source,
    /<MessageList[\s\S]*currentModelString=\{currentModelString\}/,
    'MainContent should pass currentModelString into MessageList so chat navigation does not white-screen'
  );
});
