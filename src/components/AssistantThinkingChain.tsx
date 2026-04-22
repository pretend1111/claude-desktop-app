import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Lightbulb } from 'lucide-react';

import AssistantActivityIndicator from './AssistantActivityIndicator';
import thoughtChainDirectIcon from '../assets/figma-thinking-chain/thought-chain-direct.svg';
import thoughtChainExtendedStartIcon from '../assets/figma-thinking-chain/thought-chain-extended-start.svg';
import thoughtChainStepIcon from '../assets/figma-thinking-chain/thought-chain-step.svg';
import thoughtChainWebSearchIcon from '../assets/figma-thinking-chain/thought-chain-web-search.svg';
import thoughtChainDoneIcon from '../assets/figma-thinking-chain/thought-chain-done.svg';
import thoughtChainWritePreviewIcon from '../assets/figma-thinking-chain/thought-chain-write-preview.svg';

interface ThoughtChainSearchResult {
  title: string;
  source?: string;
  url?: string;
}

interface ThoughtChainFilePreview {
  title: string;
  format: string;
  content: string;
}

export interface AssistantThinkingEvent {
  kind: 'direct' | 'focus' | 'skill' | 'tool' | 'web_search' | 'write_preview' | 'done';
  label: string;
  detail?: string;
  meta?: string;
  results?: ThoughtChainSearchResult[];
  preview?: ThoughtChainFilePreview;
}

interface AssistantThinkingChainProps {
  thinking: string;
  thinkingSummary?: string;
  isThinking?: boolean;
  isExtended?: boolean;
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
  events?: AssistantThinkingEvent[];
}

interface AssistantThinkingCompactStatusProps {
  event?: AssistantThinkingEvent | null;
  isThinking?: boolean;
}

const railClassName = 'bg-[rgba(31,31,30,0.15)] dark:bg-[rgba(248,248,246,0.18)]';
const thoughtChainIconStyle = { width: 15, height: 15 } as const;
const thoughtChainRowEnterAnimation = 'thought-chain-row-enter 220ms cubic-bezier(0.22, 1, 0.36, 1) both';
const thoughtChainResultEnterAnimation = 'thought-chain-result-enter 240ms cubic-bezier(0.22, 1, 0.36, 1) both';
const THINKING_STATUS_FALLBACK = 'Thinking deeply, stand by...';
const thoughtHeaderLabel = 'Thought';
const thoughtChainAnimationStyles = `
  @keyframes thought-chain-row-enter {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes thought-chain-result-enter {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes thought-chain-text-shimmer {
    from {
      background-position: 200% center;
    }
    to {
      background-position: 0% center;
    }
  }
`;

const TextShimmer: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <span
    className={className}
    style={{
      color: 'transparent',
      backgroundImage:
        'linear-gradient(90deg, rgba(123,121,116,0.72) 0%, rgba(55,55,52,0.92) 48%, rgba(123,121,116,0.72) 100%)',
      backgroundSize: '220% 100%',
      backgroundClip: 'text',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      animation: 'thought-chain-text-shimmer 1.6s linear infinite',
    }}
  >
    {children}
  </span>
);

const getThinkingSummary = (thinking: string, thinkingSummary?: string, isThinking?: boolean) => {
  if (isThinking && !thinkingSummary) return 'Thinking deeply, stand by...';
  if (thinkingSummary) return thinkingSummary;

  const lines = thinking
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const last = lines[lines.length - 1] || '';
  if (!last) return isThinking ? 'Thinking...' : 'Thought complete';
  return last.length > 64 ? `${last.slice(0, 64)}...` : last;
};

const normalizeThinkingLine = (line: string) =>
  line
    .trim()
    .replace(/^[-*•]\s*/, '')
    .replace(/^\d+[\.\)]\s*/, '')
    .trim();

const getThinkingLines = (thinking: string) =>
  thinking
    .split('\n')
    .map(normalizeThinkingLine)
    .filter(Boolean);

const isMeaningfullyDifferent = (a: string, b: string) =>
  a.trim().toLowerCase() !== b.trim().toLowerCase();

const getEventIcon = (kind: AssistantThinkingEvent['kind']) => {
  switch (kind) {
    case 'direct':
      return thoughtChainDirectIcon;
    case 'web_search':
      return thoughtChainWebSearchIcon;
    case 'write_preview':
      return thoughtChainWritePreviewIcon;
    case 'done':
      return thoughtChainDoneIcon;
    case 'focus':
    case 'skill':
    case 'tool':
    default:
      return thoughtChainStepIcon;
  }
};

const isMutedEvent = (kind: AssistantThinkingEvent['kind']) => kind !== 'done';

const getActiveEventIndex = (events: AssistantThinkingEvent[] | null, isThinking: boolean) => {
  if (!isThinking || !Array.isArray(events) || events.length === 0) return -1;

  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (events[index]?.kind !== 'done') return index;
  }

  return -1;
};

const buildPreviewLines = (preview?: ThoughtChainFilePreview) => {
  const content = String(preview?.content || '')
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, '  ');

  const lines = content
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return ['Preparing preview…'];
  }

  return lines.slice(0, 8).map((line) => (line.length > 92 ? `${line.slice(0, 92)}…` : line));
};

const tokenizeStreamingLabel = (text: string) =>
  text
    .split(/(\s+)/)
    .filter((token) => token.length > 0);

function useAnimatedStatusLabel(label: string, isThinking: boolean) {
  const [animatedStatusText, setAnimatedStatusText] = useState(label);

  useEffect(() => {
    const normalizedLabel = label.trim() || THINKING_STATUS_FALLBACK;

    if (!isThinking) {
      setAnimatedStatusText(normalizedLabel);
      return;
    }

    const tokens = tokenizeStreamingLabel(normalizedLabel);
    if (tokens.length === 0) {
      setAnimatedStatusText(THINKING_STATUS_FALLBACK);
      return;
    }

    setAnimatedStatusText(tokens[0]);
    let visibleTokenCount = 1;
    const timer = window.setInterval(() => {
      visibleTokenCount += 1;
      setAnimatedStatusText(tokens.slice(0, visibleTokenCount).join(''));
      if (visibleTokenCount >= tokens.length) {
        window.clearInterval(timer);
      }
    }, 42);

    return () => window.clearInterval(timer);
  }, [isThinking, label]);

  return animatedStatusText;
}

const renderSparkStatusCopy = (label: string, isThinking: boolean) => {
  const textClassName =
    "font-['Anthropic_Serif_Text:Italic',serif] text-[14px] italic leading-[21px] tracking-[-0.07px]";

  if (isThinking) {
    return <TextShimmer className={textClassName}>{label}</TextShimmer>;
  }

  return <span className={textClassName}>{label}</span>;
};

export const AssistantThinkingCompactStatus: React.FC<AssistantThinkingCompactStatusProps> = ({
  event,
  isThinking = true,
}) => {
  if (!event) return null;

  const animatedStatusText = useAnimatedStatusLabel(event.label || THINKING_STATUS_FALLBACK, isThinking);

  return (
    <div className="mt-[14px] flex min-h-[36px] items-center gap-[12px] pl-[11px] text-[#3d3d3a] dark:text-claude-text">
      <div className="flex h-[28px] w-[28px] items-center justify-center">
        <AssistantActivityIndicator
          phase={isThinking ? 'streaming' : 'done'}
          size={28}
          className="inline-block"
        />
      </div>
      <div className="min-w-0 flex-1">
        {renderSparkStatusCopy(animatedStatusText || THINKING_STATUS_FALLBACK, isThinking)}
      </div>
    </div>
  );
};

const AssistantThinkingChain: React.FC<AssistantThinkingChainProps> = ({
  thinking,
  thinkingSummary,
  isThinking = false,
  isExpanded = false,
  onToggleExpanded,
  events,
}) => {
  const [isBodyExpanded, setIsBodyExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [expandedDetailRows, setExpandedDetailRows] = useState<Record<string, boolean>>({});
  const bodyRef = useRef<HTMLDivElement | null>(null);

  const summary = useMemo(
    () => getThinkingSummary(thinking, thinkingSummary, isThinking),
    [thinking, thinkingSummary, isThinking]
  );

  const syntheticEvents = useMemo(() => {
    if (!Array.isArray(events) || events.length === 0) return null;

    const normalized = events.filter(Boolean).map((event) => ({ ...event }));
    if (!isThinking && normalized[normalized.length - 1]?.kind !== 'done') {
      normalized.push({ kind: 'done', label: 'Done' });
    }
    return normalized;
  }, [events, isThinking]);

  const activeEventIndex = useMemo(
    () => getActiveEventIndex(syntheticEvents, isThinking),
    [syntheticEvents, isThinking]
  );

  const hasDetailedEvents = useMemo(
    () => Boolean(syntheticEvents?.some((event) => typeof event.detail === 'string' && event.detail.trim().length > 0)),
    [syntheticEvents]
  );

  const hasRichResultEvents = useMemo(
    () => Boolean(
      syntheticEvents?.some((event) =>
        (event.kind === 'web_search' && Array.isArray(event.results) && event.results.length > 0) ||
        (event.kind === 'write_preview' && Boolean(event.preview))
      )
    ),
    [syntheticEvents]
  );

  const stepLabel = useMemo(() => {
    const lines = getThinkingLines(thinking);
    const candidate = [...lines]
      .reverse()
      .find((line) => line.length <= 120 && isMeaningfullyDifferent(line, summary));

    return candidate || summary;
  }, [thinking, summary]);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    setIsOverflowing(el.scrollHeight > 200);
  }, [thinking, isExpanded, isBodyExpanded]);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el || !isThinking || !isExpanded) return;
    el.scrollTop = el.scrollHeight;
  }, [thinking, isThinking, isExpanded, isBodyExpanded]);
  if (!thinking && !syntheticEvents?.length) return null;

  const canToggle = Boolean(syntheticEvents?.length) && Boolean(onToggleExpanded);

  const renderSummaryButton = () => (
    <button
      type="button"
      onClick={canToggle ? onToggleExpanded : undefined}
      className={`group/think flex w-full items-center gap-[4px] py-[4px] text-left text-[#7b7974] transition-colors dark:text-claude-textSecondary ${
        canToggle
          ? 'cursor-pointer hover:text-[#373734] dark:hover:text-claude-text'
          : 'cursor-default'
      }`}
    >
      {hasDetailedEvents && (
        <Lightbulb
          size={14}
          strokeWidth={1.75}
          className="mr-[2px] shrink-0 text-[#7b7974] dark:text-claude-textSecondary"
        />
      )}
      <span className="min-w-0 flex-1 truncate text-[14px] leading-[19.6px] tracking-[-0.1504px]">
        {hasDetailedEvents ? thoughtHeaderLabel : summary}
      </span>
      {canToggle && (
        <ChevronDown
          size={12}
          className={`shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
        />
      )}
    </button>
  );

  const renderRailSpacer = (visible: boolean, height: number = 8) => (
    <div className="relative w-full" style={{ height: `${height}px` }}>
      <div
        className={visible ? `absolute left-[9.5px] w-px ${railClassName}` : 'absolute left-[9.5px] w-px'}
        style={{ height: `${height}px` }}
      />
    </div>
  );

  const isActiveEvent = (
    event: AssistantThinkingEvent,
    index: number
  ) => isThinking && event.kind !== 'done' && index === activeEventIndex;

  const renderShimmerLabel = (label: string, className: string) => (
    <TextShimmer className={className}>{label}</TextShimmer>
  );

  const renderTimelineEvent = (
    event: AssistantThinkingEvent,
    index: number,
    total: number
  ) => {
    const muted = isMutedEvent(event.kind);
    const active = isActiveEvent(event, index);

    return (
      <div
        key={`${event.kind}-${event.label}-${index}`}
        className="w-full"
        style={{ animation: thoughtChainRowEnterAnimation, animationDelay: `${index * 45}ms` }}
      >
        {renderRailSpacer(index > 0)}
        <div className="flex items-start rounded-[8px]">
          <div className="flex w-[20px] items-start justify-center px-[2px] pt-[4px]">
            <img
              src={getEventIcon(event.kind)}
              alt=""
              className="shrink-0"
              style={thoughtChainIconStyle}
            />
          </div>
          <div className="min-w-0 flex-1 pl-[10px] pt-[2px]">
            <div className="flex items-start justify-between gap-[12px]">
              <p
                className={`min-w-0 flex-1 text-[14px] tracking-[-0.1504px] ${
                  active
                    ? "font-['Anthropic_Sans:Regular',sans-serif] leading-[19.6px] text-[#373734] dark:text-claude-text"
                    : muted
                    ? "font-['Anthropic_Sans:Regular',sans-serif] leading-[20px] text-[#7b7974] dark:text-claude-textSecondary"
                    : "font-['Anthropic_Sans:Regular',sans-serif] leading-[19.6px] text-[#373734] dark:text-claude-text"
                }`}
              >
                {active
                  ? renderShimmerLabel(
                      event.label,
                      "font-['Anthropic_Sans:Regular',sans-serif] leading-[19.6px]"
                    )
                  : event.label}
              </p>
              {event.meta && (
                <p className="shrink-0 pt-[1px] text-[12px] leading-[16.8px] text-[#7b7974] dark:text-claude-textSecondary">
                  {event.meta}
                </p>
              )}
            </div>
          </div>
        </div>
        {renderRailSpacer(index < total - 1)}
      </div>
    );
  };

  const renderCompactTimelineEvent = (
    event: AssistantThinkingEvent,
    index: number,
    total: number
  ) => {
    const muted = isMutedEvent(event.kind);

    return (
      <div
        key={`${event.kind}-${event.label}-${index}`}
        className="w-full"
        style={{ animation: thoughtChainRowEnterAnimation, animationDelay: `${index * 40}ms` }}
      >
        {renderRailSpacer(index > 0, 6)}
        <div className="flex items-start rounded-[8px]">
          <div className="flex w-[20px] items-start justify-center px-[2px] pt-[4px]">
            <img
              src={getEventIcon(event.kind)}
              alt=""
              className="shrink-0"
              style={thoughtChainIconStyle}
            />
          </div>
          <div className="min-w-0 flex-1 pl-[10px] pt-[2px]">
            <div className="flex items-start justify-between gap-[12px]">
              <p
                className={`min-w-0 flex-1 text-[13px] tracking-[-0.1304px] ${
                  muted
                    ? "font-['Anthropic_Sans:Regular',sans-serif] leading-[18px] text-[#7b7974] dark:text-claude-textSecondary"
                    : "font-['Anthropic_Sans:Regular',sans-serif] leading-[18px] text-[#373734] dark:text-claude-text"
                }`}
              >
                {event.label}
              </p>
              {event.meta && (
                <p className="shrink-0 pt-[1px] text-[11px] leading-[15px] text-[#7b7974] dark:text-claude-textSecondary">
                  {event.meta}
                </p>
              )}
            </div>
          </div>
        </div>
        {renderRailSpacer(index < total - 1, 6)}
      </div>
    );
  };

  const isExpandableDetail = (detail?: string) => {
    if (typeof detail !== 'string') return false;
    const lines = detail.split('\n').filter((line) => line.trim().length > 0);
    return detail.length > 280 || lines.length > 8;
  };

  const renderDetailedThoughtEvent = (
    event: AssistantThinkingEvent,
    index: number,
    total: number
  ) => {
    const detail = String(event.detail || '').trim();
    const detailKey = `${event.kind}-${index}`;
    const expandable = isExpandableDetail(detail);
    const expanded = Boolean(expandedDetailRows[detailKey]);

    return (
      <div
        key={`${event.kind}-${event.label}-${index}`}
        className="w-full"
        style={{ animation: thoughtChainRowEnterAnimation, animationDelay: `${index * 45}ms` }}
      >
        {renderRailSpacer(index > 0)}
        <div className="flex items-start rounded-[8px]">
          <div className="flex w-[20px] flex-col items-center gap-[4px] px-[2px] pt-[4px]">
            <img
              src={thoughtChainExtendedStartIcon}
              alt=""
              className="shrink-0"
              style={thoughtChainIconStyle}
            />
          </div>

          <div className="min-w-0 flex-1 pl-[10px] pt-[2px]">
            <div className="relative">
              <div
                className="overflow-hidden whitespace-pre-wrap font-['Anthropic_Sans:Regular',sans-serif] text-[14px] leading-[19.6px] tracking-[-0.1504px] text-[#373734] dark:text-claude-text"
                style={{ maxHeight: expandable && !expanded ? '200px' : 'none' }}
              >
                {detail}
              </div>
              {expandable && !expanded && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-claude-bg to-transparent" />
              )}
            </div>

            {expandable && (
              <button
                type="button"
                onClick={() =>
                  setExpandedDetailRows((prev) => ({
                    ...prev,
                    [detailKey]: !prev[detailKey],
                  }))
                }
                className="mt-[8px] text-[12px] leading-[16px] text-[rgba(123,121,116,0.8)] transition-colors hover:text-[#373734] dark:hover:text-claude-text"
              >
                {expanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        </div>
        {renderRailSpacer(index < total - 1)}
      </div>
    );
  };

  const renderWebSearchEvent = (
    event: AssistantThinkingEvent,
    index: number,
    total: number
  ) => {
    const active = isActiveEvent(event, index);

    return (
    <div
      key={`${event.kind}-${event.label}-${index}`}
      className="w-full"
      style={{ animation: thoughtChainRowEnterAnimation, animationDelay: `${index * 45}ms` }}
    >
      {renderRailSpacer(index > 0)}
      <div className="flex items-start rounded-[8px]">
        <div className="flex w-[20px] items-start justify-center px-[2px] pt-[4px]">
          <img
            src={thoughtChainWebSearchIcon}
            alt=""
            className="shrink-0"
            style={thoughtChainIconStyle}
          />
        </div>
        <div className="min-w-0 flex-1 pl-[10px] pt-[2px]">
          <div className="flex items-start justify-between gap-[12px]">
            <p className="min-w-0 flex-1 font-['Anthropic_Sans:Regular',sans-serif] text-[14px] leading-[20px] tracking-[-0.1504px] text-[#7b7974] dark:text-claude-textSecondary">
              {active
                ? renderShimmerLabel(
                    event.label,
                    "font-['Anthropic_Sans:Regular',sans-serif] leading-[20px]"
                  )
                : event.label}
            </p>
            {event.meta && (
              <p className="shrink-0 pt-[1px] text-[12px] leading-[16.8px] text-[#7b7974] dark:text-claude-textSecondary">
                {event.meta}
              </p>
            )}
          </div>
        </div>
      </div>

      {event.results && event.results.length > 0 && (
        <div className="flex items-stretch">
          <div className="flex w-[20px] justify-center px-[9.5px]">
            <div className={`w-px ${railClassName}`} />
          </div>
          <div className="min-w-0 flex-1 pl-[10px] pt-[4px]">
            <div className="overflow-hidden rounded-[8px] border border-[rgba(31,31,30,0.15)] bg-[rgba(255,255,255,0.5)] pb-px pl-[5px] pr-[16px] pt-[5px] dark:border-[rgba(248,248,246,0.12)] dark:bg-[rgba(255,255,255,0.05)]">
              {event.results.map((result, resultIndex) => (
                <div
                  key={`${result.url || result.title}-${resultIndex}`}
                  className="flex items-center gap-[12px] rounded-[6px] px-[8px] py-[6px]"
                  style={{
                    animation: thoughtChainResultEnterAnimation,
                    animationDelay: `${100 + resultIndex * 55}ms`,
                  }}
                >
                  <div className="h-[12px] w-[12px] shrink-0 rounded-full border border-[rgba(31,31,30,0.12)] bg-[rgba(31,31,30,0.04)] dark:border-[rgba(248,248,246,0.12)] dark:bg-[rgba(248,248,246,0.05)]" />
                  <p className="min-w-0 flex-1 truncate font-['Anthropic_Sans:Regular',sans-serif] text-[12px] leading-[16.8px] text-[#373734] dark:text-claude-text">
                    {result.title}
                  </p>
                  {result.source && (
                    <p className="shrink-0 text-[12px] leading-[16px] text-[#7b7974] dark:text-claude-textSecondary">
                      {result.source}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {renderRailSpacer(index < total - 1)}
    </div>
  );
  };

  const renderWritePreviewEvent = (
    event: AssistantThinkingEvent,
    index: number,
    total: number
  ) => {
    const previewLines = buildPreviewLines(event.preview);
    const previewFormat = (event.preview?.format || 'text').toLowerCase();
    const active = isActiveEvent(event, index);

    return (
      <div
        key={`${event.kind}-${event.label}-${index}`}
        className="w-full"
        style={{ animation: thoughtChainRowEnterAnimation, animationDelay: `${index * 45}ms` }}
      >
        {renderRailSpacer(index > 0)}
        <div className="flex items-start rounded-[8px]">
          <div className="flex w-[20px] items-start justify-center px-[2px] pt-[4px]">
            <img
              src={thoughtChainWritePreviewIcon}
              alt=""
              className="shrink-0"
              style={thoughtChainIconStyle}
            />
          </div>
          <div className="min-w-0 flex-1 pl-[10px] pt-[2px]">
            <div className="flex items-start justify-between gap-[12px]">
              <p className="min-w-0 flex-1 font-['Anthropic_Sans:Regular',sans-serif] text-[14px] leading-[20px] tracking-[-0.1504px] text-[#7b7974] dark:text-claude-textSecondary">
                {active
                  ? renderShimmerLabel(
                      event.label,
                      "font-['Anthropic_Sans:Regular',sans-serif] leading-[20px]"
                    )
                  : event.label}
              </p>
              {event.meta && (
                <p className="shrink-0 pt-[1px] text-[12px] leading-[16.8px] text-[#7b7974] dark:text-claude-textSecondary">
                  {event.meta}
                </p>
              )}
            </div>
          </div>
        </div>

        {event.preview && (
          <div className="flex items-stretch">
            <div className="flex w-[20px] justify-center px-[9.5px]">
              <div className={`w-px ${railClassName}`} />
            </div>
            <div className="min-w-0 flex-1 pl-[10px] pt-[4px]">
              <div className="overflow-hidden rounded-[12px] border border-[rgba(31,31,30,0.15)] bg-[rgba(255,255,255,0.3)] p-px dark:border-[rgba(248,248,246,0.12)] dark:bg-[rgba(255,255,255,0.04)]">
                <div className="overflow-hidden rounded-[6px] bg-white dark:bg-[#1F1F1D]">
                  <div className="flex items-center justify-between px-[12px] py-[10px]">
                    <span className="font-['Anthropic_Mono:Regular',monospace] text-[11px] leading-[16px] text-[#373734] dark:text-claude-text">
                      {previewFormat}
                    </span>
                  </div>
                  <div className="max-h-[124px] overflow-hidden px-[12px] pb-[12px]">
                    <pre className="whitespace-pre-wrap font-['Anthropic_Mono:Regular',monospace] text-[12px] leading-[16px] text-[#2B303B] dark:text-[#D7D7D4]">
                      {previewLines.join('\n')}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {renderRailSpacer(index < total - 1)}
      </div>
    );
  };

  if (syntheticEvents?.length && !hasDetailedEvents && !hasRichResultEvents) {
    const compactEvents = isThinking && activeEventIndex !== -1
      ? syntheticEvents.slice(0, activeEventIndex)
      : syntheticEvents;
    const shouldShowEvents = !canToggle || isExpanded;

    return (
      <div className="mb-3 pl-[8px] pt-[6px]">
        <style>{thoughtChainAnimationStyles}</style>
        {renderSummaryButton()}
        {shouldShowEvents && compactEvents.length > 0 && (
          <div className="overflow-hidden">
            {compactEvents.map((event, index) =>
              renderCompactTimelineEvent(event, index, compactEvents.length)
            )}
          </div>
        )}
      </div>
    );
  }

  if (syntheticEvents?.length && !hasDetailedEvents) {
    const shouldShowEvents = !canToggle || isExpanded;

    return (
      <div className="mb-4 pl-[8px] pt-[6px]">
        <style>{thoughtChainAnimationStyles}</style>
        {renderSummaryButton()}
        {shouldShowEvents && (
          <div className="overflow-hidden">
            {syntheticEvents.map((event, index) =>
              event.kind === 'web_search'
                ? renderWebSearchEvent(event, index, syntheticEvents.length)
                : event.kind === 'write_preview'
                  ? renderWritePreviewEvent(event, index, syntheticEvents.length)
                : renderTimelineEvent(event, index, syntheticEvents.length)
            )}
          </div>
        )}
      </div>
    );
  }

  if (syntheticEvents?.length) {
    const shouldShowEvents = !canToggle || isExpanded;

    return (
      <div className="mb-4 pl-[8px] pt-[6px]">
        <style>{thoughtChainAnimationStyles}</style>
        {renderSummaryButton()}
        {shouldShowEvents && (
          <div className="overflow-hidden">
            {syntheticEvents.map((event, index) => {
              if (event.detail) {
                return renderDetailedThoughtEvent(event, index, syntheticEvents.length);
              }
              if (event.kind === 'web_search') {
                return renderWebSearchEvent(event, index, syntheticEvents.length);
              }
              if (event.kind === 'write_preview') {
                return renderWritePreviewEvent(event, index, syntheticEvents.length);
              }
              return renderTimelineEvent(event, index, syntheticEvents.length);
            })}
          </div>
        )}
      </div>
    );
  }

  if (!hasDetailedEvents) {
    return (
      <div className="mb-4 pl-[8px] pt-[6px]">
        <style>{thoughtChainAnimationStyles}</style>
        {renderSummaryButton()}
        <div className="overflow-hidden">
          {renderTimelineEvent(
            { kind: 'skill', label: summary },
            0,
            isThinking ? 1 : 2
          )}
          {!isThinking &&
            renderTimelineEvent(
              { kind: 'done', label: 'Done' },
              1,
              2
            )}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 pl-[8px] pt-[6px]">
      <style>{thoughtChainAnimationStyles}</style>
      {renderSummaryButton()}

      {isExpanded && (
        <div className="overflow-hidden">
          {renderRailSpacer(false)}
          <div className="flex items-start rounded-[8px]">
            <div className="flex w-[20px] flex-col items-center gap-[4px] px-[2px] pt-[4px]">
              <img
                src={thoughtChainExtendedStartIcon}
                alt=""
                className="shrink-0"
                style={thoughtChainIconStyle}
              />
              <div className={`min-h-px w-px flex-1 ${railClassName}`} />
            </div>

            <div className="min-w-0 flex-1 pl-[10px] pt-[2px]">
              <div className="relative">
                <div
                  ref={bodyRef}
                  className="overflow-hidden whitespace-pre-wrap font-['Anthropic_Sans:Regular',sans-serif] text-[14px] leading-[19.6px] tracking-[-0.1504px] text-[#373734] dark:text-claude-text"
                  style={{ maxHeight: isBodyExpanded ? 'none' : '200px' }}
                >
                  {thinking}
                </div>
                {!isBodyExpanded && isOverflowing && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-claude-bg to-transparent" />
                )}
              </div>

              {isOverflowing && (
                <button
                  type="button"
                  onClick={() => setIsBodyExpanded((prev) => !prev)}
                  className="mt-[8px] text-[12px] leading-[16px] text-[rgba(123,121,116,0.8)] transition-colors hover:text-[#373734] dark:hover:text-claude-text"
                >
                  {isBodyExpanded ? 'Show less' : 'Show more'}
                </button>
              )}
            </div>
          </div>

          {renderTimelineEvent(
            { kind: 'skill', label: stepLabel },
            1,
            isThinking ? 2 : 3
          )}

          {!isThinking &&
            renderTimelineEvent(
              { kind: 'done', label: 'Done' },
              2,
              3
            )}
        </div>
      )}
    </div>
  );
};

export default AssistantThinkingChain;
