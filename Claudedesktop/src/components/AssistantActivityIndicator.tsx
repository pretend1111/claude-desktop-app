import React, { useEffect, useRef, useState } from 'react';
import { DotLottieReact, type DotLottie } from '@lottiefiles/dotlottie-react';
import thinkingLottie from '../assets/message-activity/lottie/thinking.lottie';
import typingLottie from '../assets/message-activity/lottie/typing.lottie';
import thinkingSpriteRaw from '../assets/message-activity/claude-thinking-sprite.svg?raw';
import {
  getPlaybackAfterDissolve,
  getSteadyPlaybackKind,
  shouldPlayDissolve,
  TYPING_FROZEN_FRAME,
  type AssistantActivityPhase,
  type AssistantPlaybackKind,
} from './assistantActivityState';

type AssistantActivityIndicatorProps = {
  phase: AssistantActivityPhase;
  didLongThinking?: boolean;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  interactive?: boolean;
};

const DISSOLVE_FRAME_COUNT = 15;
const DISSOLVE_INTERVAL_MS = 52;
const SPRITE_FRAME_SIZE = 100;

const thinkingPathMatch = thinkingSpriteRaw.match(/<path[^>]*d="([^"]+)"/);
const thinkingFillMatch = thinkingSpriteRaw.match(/<path[^>]*fill="([^"]+)"/);
const THINKING_SPRITE_PATH = thinkingPathMatch?.[1] ?? '';
const THINKING_SPRITE_FILL = thinkingFillMatch?.[1] ?? 'rgb(217, 119, 87)';

function DissolveFrame({
  frameIndex,
  size,
  className,
  style,
}: {
  frameIndex: number;
  size: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden
      className={className}
      style={{
        width: size,
        height: size,
        display: 'block',
        overflow: 'hidden',
        ...style,
      }}
    >
      <path
        d={THINKING_SPRITE_PATH}
        fill={THINKING_SPRITE_FILL}
        transform={`translate(0 ${-frameIndex * SPRITE_FRAME_SIZE})`}
      />
    </svg>
  );
}

const AssistantActivityIndicator: React.FC<AssistantActivityIndicatorProps> = ({
  phase,
  didLongThinking = false,
  size = 40,
  className,
  style,
  interactive = false,
}) => {
  const [playbackKind, setPlaybackKind] = useState<AssistantPlaybackKind>(() => getSteadyPlaybackKind(phase));
  const [playerKey, setPlayerKey] = useState(0);
  const [dissolveFrameIndex, setDissolveFrameIndex] = useState(0);
  const [dotLottie, setDotLottie] = useState<DotLottie | null>(null);
  const previousPhaseRef = useRef<AssistantActivityPhase | null>(null);
  const previousLongThinkingRef = useRef(didLongThinking);
  const dissolveIntervalRef = useRef<number | null>(null);

  const stopDissolve = () => {
    if (dissolveIntervalRef.current !== null) {
      window.clearInterval(dissolveIntervalRef.current);
      dissolveIntervalRef.current = null;
    }
  };

  const switchPlayback = (nextKind: AssistantPlaybackKind) => {
    setPlaybackKind(nextKind);
    setPlayerKey((current) => current + 1);
  };

  const playDissolveSequence = (targetPhase: Extract<AssistantActivityPhase, 'streaming' | 'done'>) => {
    stopDissolve();
    setPlaybackKind('dissolve');
    setDissolveFrameIndex(0);

    let nextFrame = 0;
    dissolveIntervalRef.current = window.setInterval(() => {
      nextFrame += 1;
      if (nextFrame >= DISSOLVE_FRAME_COUNT) {
        stopDissolve();
        switchPlayback(getPlaybackAfterDissolve(targetPhase));
        return;
      }
      setDissolveFrameIndex(nextFrame);
    }, DISSOLVE_INTERVAL_MS);
  };

  useEffect(() => {
    const previousPhase = previousPhaseRef.current;
    const previousDidLongThinking = previousLongThinkingRef.current;

    previousPhaseRef.current = phase;
    previousLongThinkingRef.current = didLongThinking;

    if (shouldPlayDissolve(previousPhase, phase, didLongThinking)) {
      playDissolveSequence('streaming');
      return;
    }

    stopDissolve();
    const nextKind = getSteadyPlaybackKind(phase);
    if (previousPhase !== phase || previousDidLongThinking !== didLongThinking || playbackKind !== nextKind) {
      switchPlayback(nextKind);
    }
  }, [didLongThinking, phase]);

  useEffect(() => {
    if (!dotLottie || playbackKind !== 'typing-frozen') return;

    const syncFrozenFrame = () => {
      if (!dotLottie.isReady || !dotLottie.isLoaded) return;
      dotLottie.setLoop(false);
      dotLottie.pause();
      dotLottie.setFrame(TYPING_FROZEN_FRAME);
    };

    syncFrozenFrame();
    dotLottie.addEventListener('ready', syncFrozenFrame);
    dotLottie.addEventListener('load', syncFrozenFrame);

    return () => {
      dotLottie.removeEventListener('ready', syncFrozenFrame);
      dotLottie.removeEventListener('load', syncFrozenFrame);
    };
  }, [dotLottie, playbackKind, playerKey]);

  useEffect(() => stopDissolve, []);

  const wrapperStyle: React.CSSProperties = {
    width: size,
    height: size,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 0,
    flexShrink: 0,
    ...style,
  };

  const isReplayable = interactive && phase === 'done' && playbackKind === 'typing-frozen';
  const handleReplay = () => {
    if (!isReplayable) return;
    playDissolveSequence('done');
  };

  const indicator =
    playbackKind === 'dissolve' ? (
      <DissolveFrame frameIndex={dissolveFrameIndex} size={size} />
    ) : (
      <DotLottieReact
        key={`${playbackKind}-${playerKey}`}
        src={playbackKind === 'thinking' ? thinkingLottie : typingLottie}
        loop={playbackKind !== 'typing-frozen'}
        autoplay={playbackKind !== 'typing-frozen'}
        useFrameInterpolation={playbackKind !== 'typing-frozen'}
        dotLottieRefCallback={setDotLottie}
      />
    );

  if (interactive && phase === 'done') {
    return (
      <button
        type="button"
        onClick={handleReplay}
        aria-label="Replay completion animation"
        aria-disabled={playbackKind === 'dissolve'}
        className={className}
        style={{
          ...wrapperStyle,
          appearance: 'none',
          background: 'transparent',
          border: 0,
          padding: 0,
          margin: 0,
          cursor: isReplayable ? 'pointer' : 'default',
        }}
      >
        {indicator}
      </button>
    );
  }

  return (
    <span className={className} style={wrapperStyle}>
      {indicator}
    </span>
  );
};

export default AssistantActivityIndicator;
