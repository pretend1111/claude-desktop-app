const HIDDEN_TOOL_NAMES = new Set(['WebSearch', 'WebFetch']);

const TOOL_LABELS = {
  Read: 'Read file',
  Write: 'Write file',
  Edit: 'Edit file',
  MultiEdit: 'Edit files',
  Bash: 'Run command',
  ListDir: 'List directory',
  Search: 'Search',
  Grep: 'Search',
  Glob: 'Find files',
};

const WRITE_FLOW_TOOL_NAMES = new Set(['Bash', 'ListDir', 'Write', 'Edit', 'MultiEdit']);

const PREVIEW_FORMAT_PRIORITY = {
  html: 0,
  markdown: 1,
  md: 1,
  txt: 2,
  jsx: 3,
  tsx: 3,
  js: 4,
  ts: 4,
  css: 5,
  json: 6,
  xml: 7,
  yaml: 8,
  yml: 8,
};

function getToolDisplayName(name) {
  return TOOL_LABELS[name] || name || 'Tool';
}

function normalizePreview(value, maxLength = 64) {
  if (typeof value !== 'string') return '';
  const cleaned = value.trim().replace(/\s+/g, ' ');
  if (!cleaned) return '';
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength - 1)}…` : cleaned;
}

function humanizeSlug(value) {
  if (typeof value !== 'string') return '';
  return value
    .trim()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripMarkdown(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[-*•]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeThinkingText(thinking) {
  if (typeof thinking !== 'string') return '';
  return thinking.replace(/\r\n/g, '\n').trim();
}

function splitReasoningBlocks(thinking) {
  const normalized = normalizeThinkingText(thinking);
  if (!normalized) return [];

  const rawBlocks = normalized
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  const mergedBlocks = [];
  for (const block of rawBlocks) {
    const previous = mergedBlocks[mergedBlocks.length - 1];
    const isListContinuation = /^[-*•]|\d+[\.\)]\s/.test(block);
    const previousInvitesDetails = typeof previous === 'string' && /[:：]$/.test(stripMarkdown(previous));

    if ((isListContinuation || previousInvitesDetails) && previous) {
      mergedBlocks[mergedBlocks.length - 1] = `${previous}\n\n${block}`;
      continue;
    }

    mergedBlocks.push(block);
  }

  if (mergedBlocks.length > 1) return mergedBlocks;

  const fallbackBlocks = normalized
    .split(/\n(?=(?:Let me|I should|I need to|First,|Next,|Then,|Perfect[.!]?|Now ))/)
    .map((block) => block.trim())
    .filter(Boolean);

  return fallbackBlocks.length > 1 ? fallbackBlocks : rawBlocks;
}

function summarizeThinkingBlock(block, maxLength = 120) {
  const lines = String(block || '')
    .split('\n')
    .map((line) => stripMarkdown(line).trim())
    .filter(Boolean);

  const firstNarrativeLine = lines.find((line) => !/^[-*•]/.test(line)) || lines[0] || '';
  const sentenceParts = (firstNarrativeLine.match(/[^.!?。！？]+[.!?。！？]?/g) || [])
    .map((part) => part.trim())
    .filter(Boolean);
  let summarySource = (sentenceParts[0] || firstNarrativeLine).trim();
  if (sentenceParts.length > 1 && summarySource.length <= 12) {
    summarySource = `${sentenceParts[0]} ${sentenceParts[1]}`.trim();
  }
  return normalizePreview(summarySource, maxLength);
}

function isToolHandoffBlock(block) {
  const cleaned = stripMarkdown(block);
  if (!cleaned) return false;
  return /^(let me|i should|first,\s*i should|next,\s*i should|next,\s*i'll|i'll|now i'?ll)/i.test(cleaned);
}

function isErrorLikeResponse(text) {
  const cleaned = stripMarkdown(text).toLowerCase();
  if (!cleaned) return false;

  return (
    /^error[:：]/.test(cleaned) ||
    /^failed\b/.test(cleaned) ||
    /^warning[:：]/.test(cleaned) ||
    /^⚠️/.test(text || '') ||
    cleaned.includes('failed to fetch') ||
    cleaned.includes('failed to create conversation') ||
    cleaned.includes('network error') ||
    cleaned.includes('request failed') ||
    cleaned.includes('authentication failed') ||
    cleaned.includes('api 认证失败') ||
    cleaned.includes('服务暂时繁忙') ||
    cleaned.includes('额度已用完') ||
    cleaned.includes('订阅已过期')
  );
}

function basename(filePath) {
  if (typeof filePath !== 'string' || !filePath.trim()) return '';
  const parts = filePath.split(/[/\\]/).filter(Boolean);
  return parts[parts.length - 1] || filePath;
}

function inferFormat(filePath) {
  const fileName = basename(filePath);
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (ext === 'md') return 'markdown';
  return ext || 'text';
}

function toSourceDomain(url) {
  if (typeof url !== 'string' || !url.trim()) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function extractHttpUrls(value) {
  if (typeof value !== 'string' || !value.trim()) return [];

  const matches = value.match(/https?:\/\/[^\s"'`)<>\]]+/gi) || [];
  const cleaned = [];
  const seen = new Set();

  for (const rawMatch of matches) {
    const candidate = rawMatch.replace(/[),.;!?]+$/g, '');
    if (!candidate) continue;

    try {
      const parsed = new URL(candidate);
      const hostname = parsed.hostname.replace(/^www\./, '').toLowerCase();
      if (!hostname) continue;
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0' || hostname === '::1') {
        continue;
      }

      const href = parsed.toString();
      if (seen.has(href)) continue;
      seen.add(href);
      cleaned.push(href);
    } catch {
      // Ignore malformed URL fragments inside commands.
    }
  }

  return cleaned;
}

function buildWebsiteVisitTitle(url) {
  try {
    const parsed = new URL(url);
    const domain = parsed.hostname.replace(/^www\./, '');
    const pathPreview = parsed.pathname
      .split('/')
      .filter(Boolean)
      .slice(0, 4)
      .join('/');

    return normalizePreview(pathPreview ? `${domain} / ${pathPreview}` : domain, 120) || url;
  } catch {
    return normalizePreview(url, 120) || url;
  }
}

function parseWebSearchPayload(resultText) {
  if (typeof resultText !== 'string' || !resultText.trim()) return null;

  const queryMatch = resultText.match(/query:\s*"([^"]+)"/i);
  const linksMatch = resultText.match(/Links:\s*(\[[\s\S]*?\])\s*\n?/);
  if (!queryMatch) return null;

  let results = [];
  if (linksMatch) {
    try {
      const parsed = JSON.parse(linksMatch[1]);
      if (Array.isArray(parsed)) {
        results = parsed
          .filter((entry) => entry && typeof entry.url === 'string')
          .map((entry) => ({
            title: normalizePreview(entry.title || entry.url, 120) || entry.url,
            source: toSourceDomain(entry.url),
            url: entry.url,
          }));
      }
    } catch {
      // Ignore malformed search payloads and fall back to the query-only event.
    }
  }

  return {
    query: normalizePreview(queryMatch[1], 96),
    results,
  };
}

function normalizeSearchResult(entry) {
  if (!entry || typeof entry.url !== 'string') return null;

  const url = entry.url.trim();
  if (!url) return null;

  return {
    title: normalizePreview(entry.title || url, 120) || url,
    source: toSourceDomain(url),
    url,
  };
}

function mergeSearchResults(...groups) {
  const merged = [];
  const seen = new Set();

  for (const group of groups) {
    if (!Array.isArray(group)) continue;

    for (const entry of group) {
      const normalized = normalizeSearchResult(entry);
      if (!normalized) continue;

      const key = normalized.url || `${normalized.title}|${normalized.source}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(normalized);
    }
  }

  return merged;
}

function getStreamedSearchResults(searchLogs, query) {
  if (!Array.isArray(searchLogs) || searchLogs.length === 0) return [];

  const normalizedQuery = normalizePreview(query, 96).toLowerCase();
  const matchingLogs = searchLogs.filter((log) => {
    const logQuery = normalizePreview(log?.query, 96).toLowerCase();
    return normalizedQuery ? logQuery === normalizedQuery : Boolean(logQuery);
  });

  if (matchingLogs.length === 0) return [];
  return mergeSearchResults(...matchingLogs.map((log) => log?.results));
}

function buildStandaloneSearchEvent(options = {}) {
  const searchLogs = Array.isArray(options.searchLogs) ? options.searchLogs : [];
  const firstLogWithQuery = searchLogs.find((log) => normalizePreview(log?.query, 96));
  const firstResults = mergeSearchResults(...searchLogs.map((log) => log?.results));

  if (!options.searchStatus && !firstLogWithQuery && firstResults.length === 0) {
    return null;
  }

  const query = normalizePreview(firstLogWithQuery?.query, 96);
  return {
    kind: 'web_search',
    label: query || 'Searching the web',
    meta: firstResults.length > 0 ? `${firstResults.length} results` : 'Searching',
    results: firstResults,
  };
}

function buildBashWebsiteVisitEvent(toolCall) {
  if (!toolCall || toolCall.name !== 'Bash') return null;

  const input = toolCall && typeof toolCall.input === 'object' && toolCall.input ? toolCall.input : {};
  const command = typeof input.command === 'string' ? input.command : '';
  const urls = extractHttpUrls(command);
  if (urls.length === 0) return null;

  const results = mergeSearchResults(
    urls.map((url) => ({
      title: buildWebsiteVisitTitle(url),
      source: toSourceDomain(url),
      url,
    }))
  );
  if (results.length === 0) return null;

  const firstSource = results[0]?.source || 'the web';
  const siteCount = results.length;
  return {
    kind: 'web_search',
    label: siteCount === 1 ? `Visiting ${firstSource}` : `Visiting ${siteCount} sites`,
    meta:
      toolCall?.status === 'running'
        ? 'Fetching'
        : `${siteCount} ${siteCount === 1 ? 'site' : 'sites'}`,
    results,
  };
}

function buildSkillEvent(toolCall) {
  const input = toolCall && typeof toolCall.input === 'object' && toolCall.input ? toolCall.input : {};
  const toolName = toolCall && toolCall.name;

  const skillSlug =
    normalizePreview(input.skill || input.skill_name || input.slug, 64) ||
    normalizePreview(
      basename(input.file_path || input.path) === 'SKILL.md'
        ? basename((input.file_path || input.path || '').split(/[/\\]/).slice(-2, -1)[0] || '')
        : '',
      64
    );

  if (toolName !== 'Skill' && !skillSlug) return null;

  const humanized = humanizeSlug(skillSlug) || 'skill';
  return {
    kind: 'skill',
    label: `Reading ${humanized} skill`,
  };
}

function collectWrittenFiles(toolCalls) {
  if (!Array.isArray(toolCalls)) return [];

  const fileContents = new Map();
  const fileOrder = [];

  for (const toolCall of toolCalls) {
    const input = toolCall && typeof toolCall.input === 'object' && toolCall.input ? toolCall.input : {};
    if (toolCall?.name === 'Write' && input.file_path && typeof input.content === 'string') {
      fileContents.set(input.file_path, input.content);
      if (!fileOrder.includes(input.file_path)) fileOrder.push(input.file_path);
    }
  }

  for (const toolCall of toolCalls) {
    const input = toolCall && typeof toolCall.input === 'object' && toolCall.input ? toolCall.input : {};
    if (
      (toolCall?.name === 'Edit' || toolCall?.name === 'MultiEdit') &&
      input.file_path &&
      typeof input.old_string === 'string' &&
      typeof input.new_string === 'string'
    ) {
      const current = fileContents.get(input.file_path);
      if (typeof current === 'string') {
        fileContents.set(input.file_path, current.replaceAll(input.old_string, input.new_string));
      }
    }
  }

  return fileOrder.map((filePath) => ({
    filePath,
    filename: basename(filePath),
    format: inferFormat(filePath),
    content: fileContents.get(filePath) || '',
  }));
}

function pickPrimaryWrittenFile(files) {
  return [...files].sort((a, b) => {
    const aPriority = PREVIEW_FORMAT_PRIORITY[a.format] ?? 99;
    const bPriority = PREVIEW_FORMAT_PRIORITY[b.format] ?? 99;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return a.filename.localeCompare(b.filename);
  })[0] || null;
}

function buildWritePreviewEvent(toolCalls, options = {}) {
  const files = collectWrittenFiles(toolCalls);
  if (files.length === 0) return null;

  const primary = pickPrimaryWrittenFile(files);
  if (!primary) return null;

  return {
    kind: 'write_preview',
    label: files.length > 1 ? 'Create the project files' : `Create ${primary.filename}`,
    meta: files.length > 1 ? `${files.length} files` : primary.format.toUpperCase(),
    preview: {
      title: primary.filename,
      format: primary.format,
      content: primary.content,
    },
  };
}

function buildWebSearchEvent(toolCall, options = {}) {
  const input = toolCall && typeof toolCall.input === 'object' && toolCall.input ? toolCall.input : {};
  const parsed = parseWebSearchPayload(toolCall && toolCall.result);
  const query = normalizePreview(input.query || input.search_query || input.q, 96) || parsed?.query;
  if (!query) return null;

  const streamedResults = getStreamedSearchResults(options.searchLogs, query);
  const results = mergeSearchResults(streamedResults, parsed?.results || []);
  return {
    kind: 'web_search',
    label: query,
    meta:
      results.length > 0
        ? `${results.length} results`
        : toolCall?.status === 'running'
          ? 'Searching'
          : undefined,
    results,
  };
}

function buildToolStepLabel(toolCall) {
  const input = toolCall && typeof toolCall.input === 'object' && toolCall.input ? toolCall.input : {};
  const toolName = toolCall && toolCall.name;

  if (toolName === 'Bash') {
    return normalizePreview(input.command)
      ? `Run command: ${normalizePreview(input.command)}`
      : 'Run command';
  }

  if (toolName === 'Write' || toolName === 'Read' || toolName === 'Edit' || toolName === 'MultiEdit') {
    const fileName = basename(input.file_path || input.path);
    const prefix = getToolDisplayName(toolName);
    return fileName ? `${prefix}: ${fileName}` : prefix;
  }

  if (toolName === 'ListDir') {
    const targetPath = basename(input.path);
    return targetPath ? `List directory: ${targetPath}` : 'List directory';
  }

  if (toolName === 'Search' || toolName === 'Grep') {
    const query = normalizePreview(input.pattern || input.query || input.search);
    return query ? `${getToolDisplayName(toolName)}: ${query}` : getToolDisplayName(toolName);
  }

  if (toolName === 'Glob') {
    const pattern = normalizePreview(input.pattern);
    return pattern ? `Find files: ${pattern}` : 'Find files';
  }

  return getToolDisplayName(toolName);
}

function buildToolEvent(toolCall, options = {}) {
  if (!toolCall || typeof toolCall !== 'object') return null;
  if (toolCall.name === 'WebFetch') return null;

  const skillEvent = buildSkillEvent(toolCall);
  if (skillEvent) return skillEvent;

  if (toolCall.name === 'WebSearch') {
    return buildWebSearchEvent(toolCall, options);
  }

  const bashWebsiteVisitEvent = buildBashWebsiteVisitEvent(toolCall);
  if (bashWebsiteVisitEvent) {
    return bashWebsiteVisitEvent;
  }

  if (HIDDEN_TOOL_NAMES.has(toolCall.name)) return null;

  return {
    kind: 'tool',
    label: buildToolStepLabel(toolCall),
    summaryLabel: getToolDisplayName(toolCall.name),
  };
}

function buildToolFallbackThinking(toolCalls, options = {}) {
  const normalizedToolCalls = Array.isArray(toolCalls) ? toolCalls : [];

  const writePreviewEvent = buildWritePreviewEvent(normalizedToolCalls, options);
  const events = [];

  for (const toolCall of normalizedToolCalls) {
    if (writePreviewEvent && WRITE_FLOW_TOOL_NAMES.has(toolCall?.name)) continue;
    const event = buildToolEvent(toolCall, options);
    if (event) events.push(event);
  }

  if (writePreviewEvent) {
    events.push(writePreviewEvent);
  }

  if (!events.some((event) => event.kind === 'web_search')) {
    const standaloneSearchEvent = buildStandaloneSearchEvent(options);
    if (standaloneSearchEvent) events.push(standaloneSearchEvent);
  }

  if (events.length === 0) return null;

  const summaryParts = [];
  for (const event of events) {
    if (event.kind === 'web_search') {
      summaryParts.push('Searched the web');
    } else if (event.kind === 'skill') {
      summaryParts.push(event.label);
    } else if (event.kind === 'write_preview') {
      summaryParts.push(event.label);
    } else if (event.kind === 'tool') {
      summaryParts.push(event.summaryLabel || event.label);
    }
  }

  const summaryHint = normalizePreview(stripMarkdown(options.summaryHint || ''), 96);
  const summary = summaryHint || [...new Set(summaryParts)].join(', ');
  const thinking = events[0].kind === 'web_search'
    ? events[0].label
    : events.map((event) => event.label).join('\n');

  return { summary, thinking, events };
}

function buildReasoningTimelineEvents(thinking, options = {}) {
  const normalizedThinking = normalizeThinkingText(thinking);
  if (!normalizedThinking) return null;

  const blocks = splitReasoningBlocks(normalizedThinking);
  if (blocks.length === 0) return null;

  const toolFallback = buildToolFallbackThinking(options.toolCalls, options);
  const toolEvents = Array.isArray(toolFallback?.events)
    ? toolFallback.events.filter((event) => event.kind !== 'done')
    : [];

  const events = [];
  const handoffBlocks = blocks.filter((block) => isToolHandoffBlock(block));
  let toolIndex = 0;

  for (const block of blocks) {
    if (toolIndex < toolEvents.length && isToolHandoffBlock(block)) {
      events.push(toolEvents[toolIndex]);
      toolIndex += 1;
      continue;
    }

    events.push({
      kind: 'focus',
      label: summarizeThinkingBlock(block, 140) || 'Thinking',
      detail: block,
    });

    if (handoffBlocks.length === 0 && toolIndex < toolEvents.length) {
      events.push(toolEvents[toolIndex]);
      toolIndex += 1;
    }
  }

  while (toolIndex < toolEvents.length) {
    events.push(toolEvents[toolIndex]);
    toolIndex += 1;
  }

  if (!options.isThinking) {
    events.push({ kind: 'done', label: 'Done' });
  }

  const summaryHint = normalizePreview(stripMarkdown(options.summaryHint || ''), 160);
  const summary =
    summaryHint ||
    summarizeThinkingBlock(blocks[blocks.length - 1], 160) ||
    'Thought complete';

  return {
    summary,
    thinking: normalizedThinking,
    events,
    hasDetailedEvents: events.some((event) => typeof event.detail === 'string' && event.detail.trim().length > 0),
  };
}

function buildResponseFallbackThinking(content) {
  const cleaned = normalizePreview(stripMarkdown(content), 220);
  if (!cleaned) return null;
  if (isErrorLikeResponse(content)) return null;

  const sentenceParts = (cleaned.match(/[^.!?。！？]+[.!?。！？]?/g) || [])
    .map((part) => part.trim())
    .filter(Boolean);
  let focusSource = sentenceParts[0] || cleaned;
  if (sentenceParts.length > 1 && focusSource.length <= 6) {
    focusSource = `${sentenceParts[0]}${sentenceParts[1]}`.trim();
  }
  const focus = normalizePreview(focusSource, 96);

  return {
    summary: 'Responding directly',
    thinking: focus
      ? `Preparing a direct reply\nFocus: ${focus}`
      : 'Preparing a direct reply',
    events: focus
      ? [
          { kind: 'direct', label: 'Preparing a direct reply' },
          { kind: 'focus', label: `Focus: ${focus}` },
        ]
      : [{ kind: 'direct', label: 'Preparing a direct reply' }],
  };
}

export {
  HIDDEN_TOOL_NAMES,
  getToolDisplayName,
  isErrorLikeResponse,
  buildToolFallbackThinking,
  buildReasoningTimelineEvents,
  buildResponseFallbackThinking,
};
