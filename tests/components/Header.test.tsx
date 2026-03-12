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
  it('keeps both desktop and mobile language selectors in full-height overlay anchors without reserving nav width', () => {
    render(<Header />);

    const header = screen.getByRole('banner');
    const desktopToggle = within(header).getByTestId('header-lang-toggle-desktop');
    const mobileToggle = within(header).getByTestId('header-lang-toggle-mobile');
    const desktopOverlay = desktopToggle.parentElement;

    expect(desktopToggle).toHaveClass('h-full');
    expect(mobileToggle).toHaveClass('h-full');
    expect(within(header).getAllByLabelText('Language selector')).toHaveLength(2);
    expect(desktopOverlay).not.toBeNull();
    expect(desktopOverlay!.className).toContain('-right-5');
    expect(desktopOverlay!.className).toContain('lg:-right-20');
    expect(desktopOverlay!.className).toContain('xl:-right-24');

    const desktopNav = within(header).getByRole('navigation', { name: 'Primary' });
    expect(desktopNav.className).not.toContain('pr-28');
    expect(desktopNav.className).not.toContain('pr-32');
  });
});