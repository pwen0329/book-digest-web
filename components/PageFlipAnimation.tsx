'use client';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Image from 'next/image';

type PageFlipProps = {
  images?: string[];
  autoPlay?: boolean;
  interval?: number;
  className?: string;
  /** If set, render a looping video (WebM + MP4) instead of the flip animation */
  videoSrc?: string;
  /** Poster image shown before video loads */
  videoPoster?: string;
};

export default function PageFlipAnimation({
  images = [
    '/images/notebook/notebook-01.webp',
    '/images/notebook/notebook-02.webp',
    '/images/notebook/notebook-03.webp',
    '/images/notebook/notebook-04.webp',
    '/images/notebook/notebook-05.webp',
    '/images/notebook/notebook-06.webp',
  ],
  autoPlay = true,
  interval = 4000,
  className = '',
  videoSrc,
  videoPoster,
}: PageFlipProps) {
  // All hooks must be called before any conditional returns
  const [currentPage, setCurrentPage] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);
  const [flipDirection, setFlipDirection] = useState<'next' | 'prev'>('next');
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Cache reduceMotion check with useMemo
  const reduceMotion = useMemo(() =>
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    []
  );

  // Pre-compute next and previous page indices
  const nextPage = useMemo(() => 
    (currentPage + 1) % images.length, 
    [currentPage, images.length]
  );
  
  const prevPage = useMemo(() => 
    currentPage > 0 ? currentPage - 1 : 0, 
    [currentPage]
  );

  // Go to next page (loops back to first when at the end)
  const goNext = useCallback(() => {
    if (isFlipping) return;
    setFlipDirection('next');
    setIsFlipping(true);
    setTimeout(() => {
      setCurrentPage((prev) => (prev >= images.length - 1 ? 0 : prev + 1));
      setIsFlipping(false);
    }, 600);
  }, [isFlipping, images.length]);

  // Go to previous page
  const goPrev = useCallback(() => {
    if (isFlipping || currentPage <= 0) return;
    setFlipDirection('prev');
    setIsFlipping(true);
    setTimeout(() => {
      setCurrentPage((prev) => prev - 1);
      setIsFlipping(false);
    }, 600);
  }, [isFlipping, currentPage]);

  // Auto-play
  useEffect(() => {
    // Skip autoplay if using video
    if (videoSrc) return;
    if (!autoPlay || reduceMotion || images.length <= 1 || isHovered) return;

    const timer = setInterval(() => {
      goNext();
    }, interval);

    return () => clearInterval(timer);
  }, [autoPlay, interval, images.length, reduceMotion, isHovered, goNext, videoSrc]);

  // Keyboard navigation
  useEffect(() => {
    // Skip keyboard nav if using video
    if (videoSrc) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goNext, goPrev, videoSrc]);

  // If a video source is provided, render a looping <video> instead of the flip animation
  if (videoSrc) {
    const webmSrc = videoSrc.replace(/\.mp4$/, '.webm');
    const mp4Src = videoSrc.replace(/\.webm$/, '.mp4');
    return (
      <div className={`relative ${className}`}>
        <div
          className="relative w-full max-w-full mx-auto min-h-[220px] sm:min-h-[280px] md:min-h-[320px] transform rotate-[-3deg] hover:rotate-[-1deg] transition-transform duration-300"
          style={{ aspectRatio: '4/3' }}
        >
          {/* Decorative video — no meaningful audio content to caption */}
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            poster={videoPoster}
            className="absolute inset-0 w-full h-full object-contain drop-shadow-xl"
            aria-hidden="true"
          >
            <source src={webmSrc} type="video/webm" />
            <source src={mp4Src} type="video/mp4" />
          </video>
        </div>
      </div>
    );
  }

  // Click handler
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const halfWidth = rect.width / 2;

    if (clickX < halfWidth) {
      goPrev();
    } else {
      goNext();
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Book container with realistic book look */}
      <div 
        className="relative w-full max-w-2xl mx-auto cursor-pointer group"
        style={{ 
          aspectRatio: '4/3',
          minHeight: '300px',
          perspective: '2000px',
        }}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        aria-label="Click to flip pages"
      >
        {/* Book outer frame / cover */}
        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-gray-700 to-gray-900 shadow-2xl">
          {/* Book spine in center */}
          <div className="absolute left-1/2 top-2 bottom-2 w-4 -translate-x-1/2 bg-gradient-to-r from-gray-600 via-gray-500 to-gray-600 rounded-sm opacity-60" />
        </div>

        {/* Book inner pages area */}
        <div className="absolute inset-3 rounded-lg overflow-hidden bg-gray-100 shadow-inner">
          {/* Current page display (full spread) */}
          <div className="absolute inset-0">
            <Image
              src={images[currentPage]}
              alt={`Page ${currentPage + 1}`}
              fill
              sizes="(max-width: 768px) 100vw, 448px"
              className="object-contain"
              priority={currentPage === 0}
            />
          </div>

          {/* Preload next page for smooth transitions */}
          <div className="absolute inset-0 opacity-0 pointer-events-none" aria-hidden="true">
            <Image
              src={images[nextPage]}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 448px"
              className="object-contain"
            />
          </div>

          {/* Center spine shadow overlay */}
          <div className="absolute left-1/2 top-0 bottom-0 w-8 -translate-x-1/2 bg-gradient-to-r from-transparent via-black/20 to-transparent z-10 pointer-events-none" />

          {/* Flipping page animation (simplified cross-fade with subtle 3D hint) */}
          {isFlipping && (
            <div
              className={`absolute inset-0 z-20 ${flipDirection === 'next' ? 'animate-page-turn-next' : 'animate-page-turn-prev'}`}
            >
              <Image
                src={images[flipDirection === 'next' ? nextPage : prevPage]}
                alt=""
                fill
                sizes="(max-width: 768px) 100vw, 448px"
                className="object-contain"
              />
            </div>
          )}
        </div>

        {/* Hover hints */}
        <div className="absolute inset-3 flex pointer-events-none z-30">
          <div className={`flex-1 flex items-center justify-start pl-4 transition-opacity duration-300 ${
            currentPage > 0 ? 'group-hover:opacity-100 opacity-0' : 'opacity-0'
          }`}>
            <div className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-end pr-4 transition-opacity duration-300 group-hover:opacity-100 opacity-0">
            <div className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation dots */}
      {images.length > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {images.map((_, idx) => (
            <button
              key={idx}
              onClick={(e) => {
                e.stopPropagation();
                if (idx === currentPage || isFlipping) return;
                setFlipDirection(idx > currentPage ? 'next' : 'prev');
                setIsFlipping(true);
                setTimeout(() => {
                  setCurrentPage(idx);
                  setIsFlipping(false);
                }, 600);
              }}
              className={`h-2 rounded-full transition-all duration-300 ${
                idx === currentPage
                  ? 'bg-brand-pink w-6'
                  : 'bg-white/30 hover:bg-white/50 w-2'
              }`}
              aria-label={`Go to page ${idx + 1}`}
              aria-current={idx === currentPage ? 'true' : 'false'}
            />
          ))}
        </div>
      )}
    </div>
  );
}
