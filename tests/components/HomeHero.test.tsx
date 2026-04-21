import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import HomeHero from '@/components/HomeHero';

// Mock next-intl
const mockUseLocale = vi.fn(() => 'en');

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      'hero.title': 'Book Digest',
      'hero.titleLine2': 'Your Reading Community',
      'hero.subtitle': 'A space to rest, read, and reconnect',
      'hero.ctaBookClub': 'Book Club',
      'hero.ctaDetox': 'Digital Detox',
    };
    return translations[key] || key;
  },
  useLocale: () => mockUseLocale(),
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// Mock PageFlipAnimation component
vi.mock('@/components/PageFlipAnimation', () => ({
  default: () => <div data-testid="page-flip-animation">Page Flip Animation</div>,
}));

describe('HomeHero', () => {
  afterEach(() => {
    cleanup();
    mockUseLocale.mockReturnValue('en');
  });

  it('renders hero section with correct content', () => {
    render(<HomeHero />);

    expect(screen.getByText('Book Digest')).toBeInTheDocument();
    expect(screen.getByText('Your Reading Community')).toBeInTheDocument();
    expect(screen.getByText('A space to rest, read, and reconnect')).toBeInTheDocument();
  });

  it('renders CTA buttons with correct links for English locale', () => {
    mockUseLocale.mockReturnValue('en');
    render(<HomeHero />);

    // Book Club button should link to TW events with MANDARIN_BOOK_CLUB filter
    const bookClubLink = screen.getByRole('link', { name: 'Book Club' });
    expect(bookClubLink).toHaveAttribute('href', '/en/events/TW?type=MANDARIN_BOOK_CLUB');

    // Digital Detox button should link to TW events with DETOX filter
    const detoxLink = screen.getByRole('link', { name: 'Digital Detox' });
    expect(detoxLink).toHaveAttribute('href', '/en/events/TW?type=DETOX');
  });

  it('renders CTA buttons with correct links for Chinese locale', () => {
    mockUseLocale.mockReturnValue('zh');
    render(<HomeHero />);

    // Book Club button should link to TW events with MANDARIN_BOOK_CLUB filter (zh locale)
    const bookClubLink = screen.getByRole('link', { name: 'Book Club' });
    expect(bookClubLink).toHaveAttribute('href', '/zh/events/TW?type=MANDARIN_BOOK_CLUB');

    // Digital Detox button should link to TW events with DETOX filter (zh locale)
    const detoxLink = screen.getByRole('link', { name: 'Digital Detox' });
    expect(detoxLink).toHaveAttribute('href', '/zh/events/TW?type=DETOX');
  });

  it('renders page flip animation', () => {
    render(<HomeHero />);

    expect(screen.getByTestId('page-flip-animation')).toBeInTheDocument();
  });
});
