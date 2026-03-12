import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import FloatingInstagram from '@/components/FloatingInstagram';

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: height });
}

describe('FloatingInstagram', () => {
  beforeEach(() => {
    setViewport(390, 844);
  });

  afterEach(() => {
    cleanup();
    window.dispatchEvent(new Event('resize'));
  });

  it('anchors closer to the lower third on mobile', async () => {
    render(<FloatingInstagram />);

    await waitFor(() => expect(screen.getByRole('link', { name: 'Follow us on Instagram' })).toHaveAttribute('data-top', '574'));
  });

  it('anchors closer to the upper third on desktop and updates on resize', async () => {
    render(<FloatingInstagram />);

    setViewport(1440, 900);
    window.dispatchEvent(new Event('resize'));

    await waitFor(() => expect(screen.getByRole('link', { name: 'Follow us on Instagram' })).toHaveAttribute('data-top', '279'));
  });
});