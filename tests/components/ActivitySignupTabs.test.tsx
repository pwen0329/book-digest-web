import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ActivitySignupTabs from '@/components/ActivitySignupTabs';

vi.mock('next/link', () => ({
  default: ({ children, href, prefetch: _prefetch, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; prefetch?: boolean }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => ({
    taiwanTitle: 'Taiwan Book Club',
    onlineTitle: 'English Book Club',
    nlTitle: 'Book Club in the Netherlands',
    detoxTitle: 'Unplug Project',
  }[key] || key),
}));

describe('ActivitySignupTabs', () => {
  it('prefers admin-provided labels while keeping the existing route structure', () => {
    render(
      <ActivitySignupTabs
        activeTab="EN"
        labels={{
          TW: 'Taipei Session',
          EN: 'Fresh English Session',
          NL: 'Amsterdam Session',
          DETOX: 'Offline Detox Lab',
        }}
      />
    );

    expect(screen.getByRole('link', { name: 'Taipei Session' })).toHaveAttribute('href', '/en/signup?location=TW');
    expect(screen.getByRole('link', { name: 'Fresh English Session' })).toHaveAttribute('href', '/en/engclub');
    expect(screen.getByRole('link', { name: 'Amsterdam Session' })).toHaveAttribute('href', '/en/signup?location=NL');
    expect(screen.getByRole('link', { name: 'Offline Detox Lab' })).toHaveAttribute('href', '/en/detox');
    expect(screen.getByRole('link', { name: 'Fresh English Session' })).toHaveAttribute('aria-current', 'page');
  });
});