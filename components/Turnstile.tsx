'use client';
import { useEffect, useRef, useCallback } from 'react';

let turnstileScriptRequested = false;

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
          size?: 'normal' | 'compact';
        }
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

type TurnstileProps = {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'compact';
};

const TURNSTILE_SITEKEY = process.env.NEXT_PUBLIC_TURNSTILE_SITEKEY || '';

export default function Turnstile({ onVerify, onExpire, onError, theme = 'dark', size = 'normal' }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const renderWidget = useCallback(() => {
    if (!containerRef.current || !window.turnstile || widgetIdRef.current) return;
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: TURNSTILE_SITEKEY,
      callback: onVerify,
      'expired-callback': onExpire,
      'error-callback': onError,
      theme,
      size,
    });
  }, [onVerify, onExpire, onError, theme, size]);

  useEffect(() => {
    if (!TURNSTILE_SITEKEY) {
      console.warn('[turnstile] NEXT_PUBLIC_TURNSTILE_SITEKEY is not configured; bot protection is disabled.');
      return;
    }

    // If Turnstile script is already loaded
    if (window.turnstile) {
      renderWidget();
      return () => {
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        }
      };
    }

    // If script tag already exists, wait for load
    if (document.querySelector('script[src*="challenges.cloudflare.com"]')) {
      // Script already injected, just wait for it to load
      intervalRef.current = setInterval(() => {
        if (window.turnstile) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          renderWidget();
        }
      }, 100);
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        }
        if (window.onTurnstileLoad === renderWidget) {
          delete window.onTurnstileLoad;
        }
      };
    }

    window.onTurnstileLoad = renderWidget;

    if (!turnstileScriptRequested) {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
      turnstileScriptRequested = true;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
      if (window.onTurnstileLoad === renderWidget) {
        delete window.onTurnstileLoad;
      }
    };
  }, [renderWidget]);

  // Don't render if no sitekey configured (graceful fallback)
  if (!TURNSTILE_SITEKEY) return null;

  return <div ref={containerRef} className="mt-2" />;
}
