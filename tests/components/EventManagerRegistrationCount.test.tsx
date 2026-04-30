import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, within } from '@testing-library/react';
import EventManager from '@/components/admin/EventManager';
import type { Event } from '@/types/event';
import type { Book } from '@/types/book';

// Mock fetch for API calls
global.fetch = vi.fn();

const mockEventTypes = [
  { code: 'MANDARIN_BOOK_CLUB', nameEn: 'Mandarin Book Club', nameZh: '中文讀書會' },
];

const mockBooks: Book[] = [
  {
    id: 1,
    slug: 'test-book',
    title: 'Test Book',
    author: 'Test Author',
    coverUrl: '/test.jpg',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

describe('EventManager - Registration Count Display with Color', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/api/admin/event-types')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ eventTypes: mockEventTypes }),
        });
      }
      // Default: return count based on URL
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ count: 0 }),
      });
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('should display registration count in blue when not full', async () => {
    const mockEvents: Event[] = [
      {
        id: 1,
        slug: 'event-1',
        eventTypeCode: 'MANDARIN_BOOK_CLUB',
        venueName: 'Venue A',
        venueCapacity: 30,
        venueLocation: 'TW',
        venueAddress: '123 Test St',
        paymentAmount: 0,
        paymentCurrency: 'TWD',
        title: 'Test Event',
        titleEn: 'Test Event',
        description: 'Test event',
        eventDate: new Date('2024-06-01').toISOString(),
        registrationOpensAt: new Date('2024-05-01').toISOString(),
        registrationClosesAt: new Date('2024-05-25').toISOString(),
        isPublished: true,
        introTemplateName: 'default_paid',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    // Mock registration count: 5 out of 30
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/api/admin/event-types')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ eventTypes: mockEventTypes }),
        });
      }
      if (url.includes('/api/admin/registrations/count')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ count: 5 }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });

    render(
      <EventManager
        initialEvents={mockEvents}
        initialBooks={mockBooks}
      />
    );

    // Wait for registration count to load in event list
    await waitFor(() => {
      const eventListItem = screen.getByText('Test Event').closest('button');
      expect(eventListItem).toBeInTheDocument();

      const countElement = within(eventListItem!).getByText('(5/30)');
      expect(countElement).toHaveClass('text-blue-400');
      expect(countElement).not.toHaveClass('text-red-400');
    });
  });

  it('should display registration count in red when at capacity', async () => {
    const mockEvents: Event[] = [
      {
        id: 2,
        slug: 'event-2',
        eventTypeCode: 'MANDARIN_BOOK_CLUB',
        venueName: 'Venue B',
        venueCapacity: 30,
        venueLocation: 'TW',
        venueAddress: '123 Test St',
        paymentAmount: 0,
        paymentCurrency: 'TWD',
        title: 'Full Event',
        titleEn: 'Full Event',
        description: 'Test event',
        eventDate: new Date('2024-06-01').toISOString(),
        registrationOpensAt: new Date('2024-05-01').toISOString(),
        registrationClosesAt: new Date('2024-05-25').toISOString(),
        isPublished: true,
        introTemplateName: 'default_paid',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    // Mock registration count: 30 out of 30 (exactly at capacity)
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/api/admin/event-types')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ eventTypes: mockEventTypes }),
        });
      }
      if (url.includes('/api/admin/registrations/count')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ count: 30 }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });

    render(
      <EventManager
        initialEvents={mockEvents}
        initialBooks={mockBooks}
      />
    );

    // Wait for registration count to load in event list
    await waitFor(() => {
      const eventListItem = screen.getByText('Full Event').closest('button');
      expect(eventListItem).toBeInTheDocument();

      const countElement = within(eventListItem!).getByText('(30/30)');
      expect(countElement).toHaveClass('text-red-400');
      expect(countElement).not.toHaveClass('text-blue-400');
    });
  });

  it('should display registration count in red when over capacity', async () => {
    const mockEvents: Event[] = [
      {
        id: 3,
        slug: 'event-3',
        eventTypeCode: 'MANDARIN_BOOK_CLUB',
        venueName: 'Venue C',
        venueCapacity: 30,
        venueLocation: 'TW',
        venueAddress: '123 Test St',
        paymentAmount: 0,
        paymentCurrency: 'TWD',
        title: 'Overbooked Event',
        titleEn: 'Overbooked Event',
        description: 'Test event',
        eventDate: new Date('2024-06-01').toISOString(),
        registrationOpensAt: new Date('2024-05-01').toISOString(),
        registrationClosesAt: new Date('2024-05-25').toISOString(),
        isPublished: true,
        introTemplateName: 'default_paid',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    // Mock registration count: 35 out of 30 (over capacity)
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/api/admin/event-types')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ eventTypes: mockEventTypes }),
        });
      }
      if (url.includes('/api/admin/registrations/count')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ count: 35 }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });

    render(
      <EventManager
        initialEvents={mockEvents}
        initialBooks={mockBooks}
      />
    );

    // Wait for registration count to load in event list
    await waitFor(() => {
      const eventListItem = screen.getByText('Overbooked Event').closest('button');
      expect(eventListItem).toBeInTheDocument();

      const countElement = within(eventListItem!).getByText('(35/30)');
      expect(countElement).toHaveClass('text-red-400');
      expect(countElement).not.toHaveClass('text-blue-400');
    });
  });

  it('should display multiple events with correct colors based on their capacity status', async () => {
    const mockEvents: Event[] = [
      {
        id: 4,
        slug: 'event-4',
        eventTypeCode: 'MANDARIN_BOOK_CLUB',
        venueName: 'Venue D',
        venueCapacity: 20,
        venueLocation: 'TW',
        venueAddress: '123 Test St',
        paymentAmount: 0,
        paymentCurrency: 'TWD',
        title: 'Partial Event',
        titleEn: 'Partial Event',
        description: 'Test event',
        eventDate: new Date('2024-06-01').toISOString(),
        registrationOpensAt: new Date('2024-05-01').toISOString(),
        registrationClosesAt: new Date('2024-05-25').toISOString(),
        isPublished: true,
        introTemplateName: 'default_paid',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 5,
        slug: 'event-5',
        eventTypeCode: 'MANDARIN_BOOK_CLUB',
        venueName: 'Venue E',
        venueCapacity: 15,
        venueLocation: 'TW',
        venueAddress: '456 Test Ave',
        paymentAmount: 0,
        paymentCurrency: 'TWD',
        title: 'Full Event',
        titleEn: 'Full Event',
        description: 'Test event',
        eventDate: new Date('2024-06-15').toISOString(),
        registrationOpensAt: new Date('2024-05-01').toISOString(),
        registrationClosesAt: new Date('2024-06-10').toISOString(),
        isPublished: true,
        introTemplateName: 'default_paid',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    // Mock different registration counts for different events
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/api/admin/event-types')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ eventTypes: mockEventTypes }),
        });
      }
      if (url.includes('eventId=4')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ count: 10 }), // 10/20 - not full
        });
      }
      if (url.includes('eventId=5')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ count: 15 }), // 15/15 - at capacity
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ count: 0 }),
      });
    });

    render(
      <EventManager
        initialEvents={mockEvents}
        initialBooks={mockBooks}
      />
    );

    // Wait for registration counts to load in event list
    await waitFor(() => {
      const partialEventItem = screen.getByText('Partial Event').closest('button');
      expect(partialEventItem).toBeInTheDocument();
      const partialCount = within(partialEventItem!).getByText('(10/20)');
      expect(partialCount).toHaveClass('text-blue-400');
      expect(partialCount).not.toHaveClass('text-red-400');

      const fullEventItem = screen.getByText('Full Event').closest('button');
      expect(fullEventItem).toBeInTheDocument();
      const fullCount = within(fullEventItem!).getByText('(15/15)');
      expect(fullCount).toHaveClass('text-red-400');
      expect(fullCount).not.toHaveClass('text-blue-400');
    });
  });
});
