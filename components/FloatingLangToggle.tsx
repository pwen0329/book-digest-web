'use client';

import { useLayoutEffect, useState } from 'react';
import LangToggle from '@/components/LangToggle';

const DESKTOP_BREAKPOINT = 768;
const TOP_GAP = 12;
const RIGHT_GAP = 12;

type FloatingMode = 'mobile' | 'desktop-fixed';

type FloatingPosition = {
  mode: FloatingMode;
  top: number;
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

  return {
    mode: 'desktop-fixed',
    top: TOP_GAP,
    right: RIGHT_GAP,
  };
}

export default function FloatingLangToggle() {
  const [position, setPosition] = useState<FloatingPosition>(() => {
    if (typeof window === 'undefined') {
      return {
        mode: 'mobile',
        top: TOP_GAP,
        right: RIGHT_GAP,
      };
    }

    return getFloatingLangTogglePosition(window.innerWidth);
  });

  useLayoutEffect(() => {
    let frameId: number | null = null;

    const syncPosition = () => {
      const nextPosition = getFloatingLangTogglePosition(window.innerWidth);
      setPosition((currentPosition) => {
        if (
          currentPosition &&
          currentPosition.mode === nextPosition.mode &&
          currentPosition.top === nextPosition.top &&
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

  const buttonClassName = position.mode === 'mobile'
    ? 'text-xs shadow-none [&>button]:min-h-11 [&>button]:min-w-[44px] [&>button]:px-3 [&>button]:py-2.5'
    : 'text-sm whitespace-nowrap [&>button]:min-h-10 [&>button]:px-3.5 [&>button]:py-2';

  return (
    <div
      data-testid="floating-lang-toggle"
      data-floating-mode={position.mode}
      data-top={position.top}
      data-right={position.right ?? ''}
      role="region"
      aria-label="Language selection"
      className="fixed z-[102] max-w-[calc(100vw-24px)]"
      style={{
        top: `calc(env(safe-area-inset-top) + ${position.top}px)`,
        right: position.right,
      }}
    >
      <LangToggle buttonClassName={buttonClassName} />
    </div>
  );
}