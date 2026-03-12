"use client";
import { useRef, useCallback, useEffect, useState } from 'react';

function getInstagramButtonSize(width: number) {
  return width >= 768 ? 48 : 44;
}

function clampTop(top: number, viewportHeight: number, buttonSize: number) {
  const minTop = 56;
  const maxTop = Math.max(minTop, viewportHeight - buttonSize - 24);
  return Math.max(minTop, Math.min(maxTop, top));
}

function getInitialTop(width: number, height: number) {
  const buttonSize = getInstagramButtonSize(width);
  const anchorRatio = width >= 768 ? 0.31 : 0.68;
  return clampTop(Math.round(height * anchorRatio), height, buttonSize);
}

export default function FloatingInstagram() {
  const btnRef = useRef<HTMLAnchorElement>(null);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startTop = useRef(0);
  const moved = useRef(false);
  const [topPx, setTopPx] = useState<number | null>(null);

  useEffect(() => {
    const syncPosition = () => {
      setTopPx(getInitialTop(window.innerWidth, window.innerHeight));
    };

    syncPosition();
    window.addEventListener('resize', syncPosition);

    return () => {
      window.removeEventListener('resize', syncPosition);
    };
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    moved.current = false;
    startY.current = e.clientY;
    startTop.current = topPx ?? 0;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  }, [topPx]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dy = e.clientY - startY.current;
    if (Math.abs(dy) > 3) moved.current = true;
    const newTop = clampTop(startTop.current + dy, window.innerHeight, getInstagramButtonSize(window.innerWidth));
    setTopPx(newTop);
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    dragging.current = false;
    // If user dragged, prevent the click/navigation
    if (moved.current) {
      e.preventDefault();
    }
  }, []);

  const onClick = useCallback((e: React.MouseEvent) => {
    if (moved.current) {
      e.preventDefault();
      moved.current = false;
    }
  }, []);

  if (topPx === null) return null;

  return (
    <a
      ref={btnRef}
      href="https://www.instagram.com/bookdigest_tw/"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed right-3 md:right-5 z-30 flex items-center justify-center w-11 h-11 md:w-12 md:h-12 rounded-full bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] shadow-lg hover:shadow-xl hover:scale-110 transition-shadow cursor-grab active:cursor-grabbing select-none touch-none"
      style={{ top: topPx }}
      aria-label="Follow us on Instagram"
      data-top={topPx}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onClick={onClick}
    >
      <svg className="w-5 h-5 md:w-6 md:h-6 text-white pointer-events-none" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
      </svg>
    </a>
  );
}
