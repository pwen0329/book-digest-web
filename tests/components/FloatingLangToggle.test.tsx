import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FloatingLangToggle from '@/components/FloatingLangToggle';

const originalInnerWidth = window.innerWidth;

function setViewport(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
}

vi.mock('next/navigation', () => ({
  usePathname: () => '/en/books',
  useSearchParams: () => new URLSearchParams('location=TW'),
}));

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
}));

describe('FloatingLangToggle', () => {
  beforeEach(() => {
    setViewport(1440);
  });

  afterEach(() => {
    cleanup();
    setViewport(originalInnerWidth);
  });

  it('pins the toggle outside the header shell on wide desktop viewports', async () => {
    render(<FloatingLangToggle />);

    await waitFor(() => expect(screen.getByTestId('floating-lang-toggle')).toHaveAttribute('data-floating-mode', 'desktop-fixed'));
    expect(screen.getByTestId('floating-lang-toggle')).toHaveAttribute('data-right', '12');
    expect(screen.getByTestId('floating-lang-toggle')).toHaveAttribute('data-top', '12');
  });

  it('keeps the toggle in the same top-right lane on narrower desktop widths', async () => {
    setViewport(1024);
    render(<FloatingLangToggle />);

    await waitFor(() => expect(screen.getByTestId('floating-lang-toggle')).toHaveAttribute('data-floating-mode', 'desktop-fixed'));
    expect(screen.getByTestId('floating-lang-toggle')).toHaveAttribute('data-right', '12');
    expect(screen.getByTestId('floating-lang-toggle')).toHaveAttribute('data-top', '12');
  });

  it('pins the toggle to the top-right on mobile widths', async () => {
    setViewport(390);
    render(<FloatingLangToggle />);

    await waitFor(() => expect(screen.getByTestId('floating-lang-toggle')).toHaveAttribute('data-floating-mode', 'mobile'));
    expect(screen.getByTestId('floating-lang-toggle')).toHaveAttribute('data-right', '12');
    expect(screen.getByTestId('floating-lang-toggle')).toHaveAttribute('data-top', '12');
  });

  it('switches locale through the floating toggle controls', async () => {
    render(<FloatingLangToggle />);

    const chineseLink = await screen.findByRole('link', { name: 'Switch to Chinese' });
    expect(chineseLink).toHaveAttribute('href', '/zh/books?location=TW');
  });
});