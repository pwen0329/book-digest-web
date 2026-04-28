import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import VenueEventsClient from '@/app/[locale]/events/[venueLocation]/client';
import type { Event } from '@/types/event';
import type { EventType } from '@/types/event-type';
import { EventRegistrationStatus } from '@/types/event';

// Mock next/navigation
let mockSearchParams = new URLSearchParams();
let mockPushHistory: Array<{ url: string; options?: any }> = [];

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: (url: string, options?: any) => {
      mockPushHistory.push({ url, options });
    },
  }),
  useSearchParams: () => mockSearchParams,
}));

vi.mock('next/link', () => ({
  default: ({ children, href, prefetch: _prefetch, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; prefetch?: boolean }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock('next/image', () => ({
  default: ({ alt, src, onError, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { onError?: () => void }) => (
    <img alt={alt} src={src as string} onError={onError} {...props} />
  ),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      signUp: 'Sign Up',
      comingSoon: 'Coming Soon',
      registrationClosed: 'Registration Closed',
      fullTitle: 'Registration Full',
    };
    return translations[key] || key;
  },
}));

describe('VenueEventsClient URL Parameter Behavior', () => {
  const mockEventTypes: EventType[] = [
    { code: 'MANDARIN_BOOK_CLUB', nameEn: 'Mandarin Book Club', nameZh: '中文讀書會', onlinePossible: false },
    { code: 'ENGLISH_BOOK_CLUB', nameEn: 'English Book Club', nameZh: '英文讀書會', onlinePossible: true },
    { code: 'FAMILY_READING_CLUB', nameEn: 'Family Reading Club', nameZh: '親子讀書會', onlinePossible: false },
    { code: 'DETOX', nameEn: 'Detox', nameZh: '數位排毒', onlinePossible: false },
  ];

  const mockEvents: Event[] = [
    {
      id: 1,
      slug: 'mandarin-club-1',
      eventTypeCode: 'MANDARIN_BOOK_CLUB',
      venueName: 'Test Venue',
      venueCapacity: 30,
      venueLocation: 'TW',
      paymentAmount: 0,
      paymentCurrency: 'TWD',
      title: 'Mandarin Event 1',
      eventDate: '2026-04-15T18:00:00Z',
      registrationOpensAt: '2026-03-01T00:00:00Z',
      registrationClosesAt: '2026-04-14T23:59:59Z',
      isPublished: true,
      introTemplateName: 'default_paid',
      registrationStatus: EventRegistrationStatus.OPEN,
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    },
    {
      id: 2,
      slug: 'english-club-1',
      eventTypeCode: 'ENGLISH_BOOK_CLUB',
      venueName: 'Test Venue',
      venueCapacity: 30,
      venueLocation: 'TW',
      paymentAmount: 0,
      paymentCurrency: 'TWD',
      title: 'English Event 1',
      eventDate: '2026-04-20T18:00:00Z',
      registrationOpensAt: '2026-03-01T00:00:00Z',
      registrationClosesAt: '2026-04-19T23:59:59Z',
      isPublished: true,
      introTemplateName: 'default_paid',
      registrationStatus: EventRegistrationStatus.FULL,
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    },
    {
      id: 3,
      slug: 'detox-1',
      eventTypeCode: 'DETOX',
      venueName: 'Test Venue',
      venueCapacity: 30,
      venueLocation: 'TW',
      paymentAmount: 0,
      paymentCurrency: 'TWD',
      title: 'Detox Event 1',
      eventDate: '2026-04-25T18:00:00Z',
      registrationOpensAt: '2026-05-01T00:00:00Z',
      registrationClosesAt: '2026-04-24T23:59:59Z',
      isPublished: true,
      introTemplateName: 'default_paid',
      registrationStatus: EventRegistrationStatus.UPCOMING,
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    },
  ];

  beforeEach(() => {
    mockSearchParams = new URLSearchParams();
    mockPushHistory = [];
    vi.clearAllMocks();
  });

  it('shows first event type with events when no URL parameter', () => {
    render(
      <VenueEventsClient
        locale="en"
        venueLocation="TW"
        events={mockEvents}
        eventTypes={mockEventTypes}
      />
    );

    // Should show Detox button as active (first in reordered list: DETOX, MANDARIN, ENGLISH, FAMILY)
    const detoxButton = screen.getByRole('button', { name: 'Detox' });
    expect(detoxButton).toHaveClass('bg-white/20');

    // Should display Detox event
    expect(screen.getByText('Detox Event 1')).toBeInTheDocument();
  });

  it('updates URL when clicking event type tab', async () => {
    // Mock window.history.replaceState
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');

    render(
      <VenueEventsClient
        locale="en"
        venueLocation="TW"
        events={mockEvents}
        eventTypes={mockEventTypes}
      />
    );

    const detoxButtons = screen.getAllByRole('button', { name: 'Detox' });
    fireEvent.click(detoxButtons[0]);

    await waitFor(() => {
      expect(replaceStateSpy).toHaveBeenCalledWith(
        null,
        '',
        expect.stringContaining('type=DETOX')
      );
    });

    replaceStateSpy.mockRestore();
  });

  it('shows correct CTA buttons based on registration status', () => {
    render(
      <VenueEventsClient
        locale="en"
        venueLocation="TW"
        events={mockEvents}
        eventTypes={mockEventTypes}
      />
    );

    // Default shows Detox (UPCOMING) - should have Coming Soon button
    const comingSoonButtons = screen.getAllByRole('button', { name: 'Coming Soon' });
    expect(comingSoonButtons[0]).toBeDisabled();

    // Switch to Mandarin (OPEN) - should have Sign Up link
    const mandarinButtons = screen.getAllByRole('button', { name: 'Mandarin Book Club' });
    fireEvent.click(mandarinButtons[0]);
    const signUpLinks = screen.getAllByRole('link', { name: 'Sign Up' });
    expect(signUpLinks[0]).toHaveAttribute('href', '/en/signup/mandarin-club-1');

    // Switch to English club (FULL)
    const englishButtons = screen.getAllByRole('button', { name: 'English Book Club' });
    fireEvent.click(englishButtons[0]);
    const fullButtons = screen.getAllByRole('button', { name: 'Registration Full' });
    expect(fullButtons[0]).toBeDisabled();
  });

  it('uses Chinese translations when locale is zh', () => {
    render(
      <VenueEventsClient
        locale="zh"
        venueLocation="TW"
        events={mockEvents}
        eventTypes={mockEventTypes}
      />
    );

    // Should show Chinese event type names
    expect(screen.getByRole('button', { name: '中文讀書會' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '英文讀書會' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '親子讀書會' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '數位排毒' })).toBeInTheDocument();
  });

  it('displays event type tabs in correct order: DETOX, MANDARIN, ENGLISH, FAMILY', () => {
    render(
      <VenueEventsClient
        locale="en"
        venueLocation="TW"
        events={mockEvents}
        eventTypes={mockEventTypes}
      />
    );

    // Get all tab buttons
    const buttons = screen.getAllByRole('button');

    // Filter out CTA buttons (Coming Soon, Sign Up, etc.) - they appear after the tabs
    // Tab buttons are the first 4 buttons
    const tabButtons = buttons.slice(0, 4);

    // Verify order: Detox, Mandarin Book Club, English Book Club, Family Reading Club
    expect(tabButtons[0]).toHaveTextContent('Detox');
    expect(tabButtons[1]).toHaveTextContent('Mandarin Book Club');
    expect(tabButtons[2]).toHaveTextContent('English Book Club');
    expect(tabButtons[3]).toHaveTextContent('Family Reading Club');
  });

});
