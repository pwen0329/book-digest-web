import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FloatingLangToggle from '@/components/FloatingLangToggle';

const originalInnerWidth = window.innerWidth;
const replaceMock = vi.fn();

function setViewport(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
}

vi.mock('next/navigation', () => ({
  usePathname: () => '/en/books',
  useRouter: () => ({ replace: replaceMock }),
}));

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
}));

describe('FloatingLangToggle', () => {
  beforeEach(() => {
    setViewport(1440);
    replaceMock.mockReset();
  });

  afterEach(() => {
    cleanup();
    setViewport(originalInnerWidth);
  });

  it('pins the toggle outside the header shell on wide desktop viewports', async () => {
    render(<FloatingLangToggle />);

    await waitFor(() => expect(screen.getByTestId('floating-lang-toggle')).toHaveAttribute('data-floating-mode', 'desktop-wide'));
    const left = Number(screen.getByTestId('floating-lang-toggle').getAttribute('data-left'));
    expect(left).toBeGreaterThan(1320);
    expect(left).toBeLessThan(1340);
  });

  it('moves the toggle below the header on compact desktop widths', async () => {
    setViewport(1024);
    render(<FloatingLangToggle />);

    await waitFor(() => expect(screen.getByTestId('floating-lang-toggle')).toHaveAttribute('data-floating-mode', 'desktop-compact'));
    expect(screen.getByTestId('floating-lang-toggle')).toHaveAttribute('data-right', '12');
    const top = Number(screen.getByTestId('floating-lang-toggle').getAttribute('data-top'));
    expect(top).toBeGreaterThanOrEqual(136);
    expect(top).toBeLessThanOrEqual(144);
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

    const chineseButton = await screen.findByRole('button', { name: 'Switch to Chinese' });
    fireEvent.click(chineseButton);

    expect(replaceMock).toHaveBeenCalledWith('/zh/books', { scroll: false });
  });
});