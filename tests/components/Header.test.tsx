import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Header from '@/components/Header';

vi.mock('next/link', () => ({
  default: ({ children, href, prefetch: _prefetch, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; prefetch?: boolean }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock('next/image', () => ({
  default: ({ alt, unoptimized: _unoptimized, priority: _priority, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { unoptimized?: boolean; priority?: boolean }) => <img alt={alt} {...props} />,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/en/books',
}));

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => ({
    books: 'Books',
    events: 'Events',
    about: 'About Us',
    joinUs: 'Join Us',
  }[key] || key),
}));

vi.mock('@/components/LangToggle', () => ({
  default: ({ buttonClassName: _buttonClassName, ...props }: React.HTMLAttributes<HTMLDivElement> & { buttonClassName?: string }) => (
    <div {...props}>
      <div aria-label="Language selector">Language selector</div>
    </div>
  ),
}));

describe('Header', () => {
  it('keeps both desktop and mobile language selectors inside the header shell', () => {
    render(<Header />);

    const header = screen.getByRole('banner');
    expect(within(header).getByTestId('header-lang-toggle-desktop')).toBeInTheDocument();
    expect(within(header).getByTestId('header-lang-toggle-mobile')).toBeInTheDocument();
    expect(within(header).getAllByLabelText('Language selector')).toHaveLength(2);
  });
});