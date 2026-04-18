'use client';
import { useEffect, useRef, useCallback } from 'react';
import { CLIENT_ENV } from '@/lib/env';

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
  }
}

type TurnstileProps = {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'compact';
};

const TURNSTILE_SITEKEY = CLIENT_ENV.TURNSTILE_SITEKEY;

function getTurnstileScriptNonce(): string | null {
  return document.querySelector('meta[name="csp-nonce"]')?.getAttribute('content') || null;
}

export default function Turnstile({ onVerify, onExpire, onError, theme = 'dark', size = 'normal' }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const pollIntervalsRef = useRef<Array<ReturnType<typeof setInterval>>>([]);

  const clearPollIntervals = useCallback(() => {
    for (const interval of pollIntervalsRef.current) {
      clearInterval(interval);
    }
    pollIntervalsRef.current = [];
  }, []);

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
    const cleanupWidget = () => {
      clearPollIntervals();
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };

    if (!TURNSTILE_SITEKEY) {
      console.warn('[turnstile] NEXT_PUBLIC_TURNSTILE_SITEKEY is not configured; bot protection is disabled.');
      return;
    }

    if (window.turnstile) {
      renderWidget();
      return cleanupWidget;
    }

    const existingScript = document.querySelector<HTMLScriptElement>('script[data-turnstile-script="true"]');
    if (existingScript) {
      const onLoad = () => {
        renderWidget();
      };

      existingScript.addEventListener('load', onLoad, { once: true });

      const pollInterval = setInterval(() => {
        if (window.turnstile) {
          clearPollIntervals();
          renderWidget();
        }
      }, 100);

      pollIntervalsRef.current.push(pollInterval);

      return () => {
        existingScript.removeEventListener('load', onLoad);
        cleanupWidget();
      };
    }

    if (!turnstileScriptRequested) {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.dataset.turnstileScript = 'true';
      const nonce = getTurnstileScriptNonce();
      if (nonce) {
        script.setAttribute('nonce', nonce);
      }
      script.addEventListener('load', renderWidget, { once: true });
      document.head.appendChild(script);
      turnstileScriptRequested = true;
    }

    return cleanupWidget;
  }, [clearPollIntervals, renderWidget]);

  // Don't render if no sitekey configured (graceful fallback)
  if (!TURNSTILE_SITEKEY) return null;

  return <div ref={containerRef} className="mt-2" />;
}
