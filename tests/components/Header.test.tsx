import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Header from '@/components/Header';

let currentPathname = '/en/books';

vi.mock('next/link', () => ({
  default: ({ children, href, prefetch: _prefetch, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; prefetch?: boolean }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock('next/image', () => ({
  default: ({ alt, unoptimized: _unoptimized, priority: _priority, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { unoptimized?: boolean; priority?: boolean }) => <img alt={alt} {...props} />,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => currentPathname,
}));

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => ({
    books: 'Books',
    events: 'Events',
    about: 'About Us',
    joinUs: 'Join Us',
    taiwan: 'Taiwan',
    netherlands: 'Netherlands',
    online: 'Online',
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
  it('keeps the centered mobile home link and desktop nav centered without embedding the language toggle in the header', () => {
    currentPathname = '/en/books';
    render(<Header />);

    const header = screen.getByRole('banner');
    const mobileHomeLink = within(header).getByTestId('header-home-link-mobile');

    expect(within(header).queryByLabelText('Language selector')).not.toBeInTheDocument();
    expect(mobileHomeLink).toBeInTheDocument();

    const desktopNav = within(header).getByRole('navigation', { name: 'Primary' });
    const shell = within(header).getByTestId('header-shell');
    expect(desktopNav.className).toContain('md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_minmax(0,1fr)_minmax(0,1fr)]');
    expect(shell.className).not.toContain('pr-');
  });

  it('does not mark partial route prefixes as active desktop links', () => {
    currentPathname = '/en/about-archive';
    render(<Header />);

    const aboutLink = within(screen.getAllByTestId('header-primary-nav')[0]).getByRole('link', { name: 'About Us' });
    expect(aboutLink).not.toHaveAttribute('aria-current', 'page');
  });

  it('renders events dropdown button instead of direct link', () => {
    currentPathname = '/en';
    const { container } = render(<Header />);

    // Get first header (in case of StrictMode duplicate rendering)
    const header = container.querySelector('header[data-ready="true"]') as HTMLElement;
    expect(header).toBeInTheDocument();

    const desktopNav = within(header).getByRole('navigation', { name: 'Primary' });

    // Should have Events button, not link
    const eventsButton = within(desktopNav).getByRole('button', { name: /Events/i });
    expect(eventsButton).toBeInTheDocument();
    expect(eventsButton).toHaveAttribute('aria-expanded');
    expect(eventsButton).toHaveAttribute('aria-haspopup', 'true');

    // Should not have a direct Events link
    expect(within(desktopNav).queryByRole('link', { name: 'Events' })).not.toBeInTheDocument();
  });

  it('marks venue events page as active in navigation', () => {
    currentPathname = '/en/events/TW';
    const { container } = render(<Header />);

    // Get first header (in case of StrictMode duplicate rendering)
    const header = container.querySelector('header[data-ready="true"]') as HTMLElement;
    expect(header).toBeInTheDocument();

    const desktopNav = within(header).getByRole('navigation', { name: 'Primary' });

    // Events dropdown button should show active styling when on any venue page
    const eventsButton = within(desktopNav).getByRole('button', { name: /Events/i });
    expect(eventsButton.className).toContain('text-brand-pink');
    expect(eventsButton.className).toContain('font-bold');
  });
});