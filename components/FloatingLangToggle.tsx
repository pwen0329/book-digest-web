'use client';

import { useEffect, useState } from 'react';
import LangToggle from '@/components/LangToggle';

const DESKTOP_BREAKPOINT = 768;
const WIDE_FLOAT_BREAKPOINT = 1328;
const HEADER_SHELL_MAX_WIDTH = 1200;
const TOP_GAP = 12;
const HEADER_CLEARANCE_TOP = 140;
const RIGHT_GAP = 12;

type FloatingMode = 'mobile' | 'desktop-compact' | 'desktop-wide';

type FloatingPosition = {
  mode: FloatingMode;
  top: number;
  left?: number;
  right?: number;
};

function getFloatingLangTogglePosition(width: number): FloatingPosition {
  if (width < DESKTOP_BREAKPOINT) {
    return {
      mode: 'mobile',
      top: TOP_GAP,
      right: TOP_GAP,
    };
  }

  if (width >= WIDE_FLOAT_BREAKPOINT) {
    const shellWidth = Math.min(width, HEADER_SHELL_MAX_WIDTH);
    const shellRight = (width + shellWidth) / 2;

    return {
      mode: 'desktop-wide',
      top: TOP_GAP,
      left: shellRight + RIGHT_GAP,
    };
  }

  return {
    mode: 'desktop-compact',
    top: HEADER_CLEARANCE_TOP,
    right: TOP_GAP,
  };
}

export default function FloatingLangToggle() {
  const [position, setPosition] = useState<FloatingPosition | null>(null);

  useEffect(() => {
    let frameId: number | null = null;

    const syncPosition = () => {
      const nextPosition = getFloatingLangTogglePosition(window.innerWidth);
      setPosition((currentPosition) => {
        if (
          currentPosition &&
          currentPosition.mode === nextPosition.mode &&
          currentPosition.top === nextPosition.top &&
          currentPosition.left === nextPosition.left &&
          currentPosition.right === nextPosition.right
        ) {
          return currentPosition;
        }

        return nextPosition;
      });
    };

    const scheduleSyncPosition = () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        syncPosition();
      });
    };

    syncPosition();
    window.addEventListener('resize', scheduleSyncPosition);

    return () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
      window.removeEventListener('resize', scheduleSyncPosition);
    };
  }, []);

  if (!position) {
    return null;
  }

  const buttonClassName = position.mode === 'mobile'
    ? 'text-xs shadow-none [&>button]:min-h-11 [&>button]:min-w-[44px] [&>button]:px-3 [&>button]:py-2.5'
    : 'text-sm [&>button]:px-3.5 [&>button]:py-2';

  return (
    <div
      data-testid="floating-lang-toggle"
      data-floating-mode={position.mode}
      data-top={position.top}
      data-left={position.left ?? ''}
      data-right={position.right ?? ''}
      role="presentation"
      className="fixed z-[70]"
      style={{
        top: `calc(env(safe-area-inset-top) + ${position.top}px)`,
        left: position.left,
        right: position.right,
      }}
    >
      <LangToggle buttonClassName={buttonClassName} />
    </div>
  );
}