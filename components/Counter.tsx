'use client';
import { useEffect, useRef, useState, useMemo } from 'react';

// Custom hook to detect when element is in view (only triggers once)
function useOnceInView<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);
  
  useEffect(() => {
    if (!ref.current || seen) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio >= 0.5) {
            setSeen(true);
            io.disconnect();
            break;
          }
        }
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [seen]);
  
  return { ref, seen } as const;
}

export default function Counter({ target, label }: { target: number; label: string }) {
  const { ref, seen } = useOnceInView<HTMLDivElement>();
  const [value, setValue] = useState(0);
  
  // Cache reduceMotion check with useMemo
  const reduceMotion = useMemo(() =>
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    []
  );

  useEffect(() => {
    if (!seen) return;
    if (reduceMotion) {
      setValue(target);
      return;
    }
    const duration = 1200;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);
      setValue(Math.round(target * progress));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [seen, target, reduceMotion]);

  return (
    <div ref={ref} className="text-center">
      <div className="text-[11px] sm:text-sm md:text-base text-white/70 font-outfit uppercase tracking-wider mb-3 leading-snug whitespace-normal max-w-[12ch] sm:max-w-none mx-auto">
        {label}
      </div>
      <div 
        className="tabular-nums font-outfit" 
        style={{ 
          fontSize: 'clamp(48px, 10vw, 92px)', 
          fontWeight: 100, 
          lineHeight: '1', 
          letterSpacing: '-0.02em',
          fontVariationSettings: '"wght" 100'
        }}
      >
        {value.toLocaleString()}
      </div>
    </div>
  );
}
