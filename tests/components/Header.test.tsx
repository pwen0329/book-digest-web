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
  it('keeps the centered mobile home link and desktop nav width stable without embedding the language toggle in the header', () => {
    render(<Header />);

    const header = screen.getByRole('banner');
    const mobileHomeLink = within(header).getByTestId('header-home-link-mobile');

    expect(within(header).queryByLabelText('Language selector')).not.toBeInTheDocument();
    expect(mobileHomeLink).toBeInTheDocument();

    const desktopNav = within(header).getByRole('navigation', { name: 'Primary' });
    expect(desktopNav.className).not.toContain('pr-28');
    expect(desktopNav.className).not.toContain('pr-32');
  });
});