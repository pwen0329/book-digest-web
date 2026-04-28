import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EventManager from '@/components/admin/EventManager';
import type { Event } from '@/types/event';
import type { Book } from '@/types/book';

// Mock fetch for API calls
global.fetch = vi.fn();

const mockEventTypes = [
  { code: 'MANDARIN_BOOK_CLUB', nameEn: 'Mandarin Book Club', nameZh: '中文讀書會' },
  { code: 'ENGLISH_BOOK_CLUB', nameEn: 'English Book Club', nameZh: '英文讀書會' },
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

const mockEvents: Event[] = [
  {
    id: 1,
    slug: 'event-1',
    eventTypeCode: 'MANDARIN_BOOK_CLUB',
    venueName: 'Venue A',
    venueCapacity: 20,
    venueLocation: 'TW',
    venueAddress: '123 Test St',
    paymentAmount: 0,
    paymentCurrency: 'TWD',
    title: 'Mandarin Event 1',
    titleEn: 'Mandarin Event 1',
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
    id: 2,
    slug: 'event-2',
    eventTypeCode: 'ENGLISH_BOOK_CLUB',
    venueName: 'Venue A',
    venueCapacity: 20,
    venueLocation: 'TW',
    venueAddress: '123 Test St',
    paymentAmount: 0,
    paymentCurrency: 'TWD',
    title: 'English Event 1',
    titleEn: 'English Event 1',
    description: 'Test event',
    eventDate: new Date('2024-06-15').toISOString(),
    registrationOpensAt: new Date('2024-05-01').toISOString(),
    registrationClosesAt: new Date('2024-06-10').toISOString(),
    isPublished: true,
    introTemplateName: 'default_paid',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 3,
    slug: 'event-3',
    eventTypeCode: 'MANDARIN_BOOK_CLUB',
    venueName: 'Venue A',
    venueCapacity: 20,
    venueLocation: 'TW',
    venueAddress: '123 Test St',
    paymentAmount: 0,
    paymentCurrency: 'TWD',
    title: 'Mandarin Event 2',
    titleEn: 'Mandarin Event 2',
    description: 'Test event',
    eventDate: new Date('2024-07-01').toISOString(),
    registrationOpensAt: new Date('2024-06-01').toISOString(),
    registrationClosesAt: new Date('2024-06-25').toISOString(),
    isPublished: true,
    introTemplateName: 'default_paid',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

describe('EventManager - Filter with Loading State', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
          json: () => Promise.resolve({ count: 0 }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('should render filter dropdown with event types', async () => {
    render(
      <EventManager
        initialEvents={mockEvents}
        initialBooks={mockBooks}
      />
    );

    // Wait for event types to load
    const select = await screen.findByRole('combobox', { name: /filter by event type/i });
    expect(select).toBeInTheDocument();

    await waitFor(() => {
      const options = within(select).getAllByRole('option');
      expect(options.length).toBeGreaterThan(1);
    });
  });

  it('should display event count', async () => {
    render(
      <EventManager
        initialEvents={mockEvents}
        initialBooks={mockBooks}
      />
    );

    // Should show count of all events
    await waitFor(() => {
      expect(screen.getByText(/Events \(/)).toBeInTheDocument();
    });
  });

  it('should filter events by selected event type', async () => {
    const user = userEvent.setup();
    render(
      <EventManager
        initialEvents={mockEvents}
        initialBooks={mockBooks}
      />
    );

    // Wait for event types to load
    const select = await screen.findByRole('combobox', { name: /filter by event type/i });
    await waitFor(() => {
      expect(select).not.toBeDisabled();
    });

    // Verify all events are visible initially
    expect(screen.getByText('Mandarin Event 1')).toBeInTheDocument();
    expect(screen.getByText('English Event 1')).toBeInTheDocument();
    expect(screen.getByText('Mandarin Event 2')).toBeInTheDocument();

    // Filter by Mandarin Book Club
    await user.selectOptions(select, 'MANDARIN_BOOK_CLUB');

    // Should show only Mandarin events
    await waitFor(() => {
      expect(screen.getByText('Mandarin Event 1')).toBeInTheDocument();
      expect(screen.getByText('Mandarin Event 2')).toBeInTheDocument();
      expect(screen.queryByText('English Event 1')).not.toBeInTheDocument();
    });

    // Filter by English Book Club
    await user.selectOptions(select, 'ENGLISH_BOOK_CLUB');

    // Should show only English event
    await waitFor(() => {
      expect(screen.getByText('English Event 1')).toBeInTheDocument();
      expect(screen.queryByText('Mandarin Event 1')).not.toBeInTheDocument();
      expect(screen.queryByText('Mandarin Event 2')).not.toBeInTheDocument();
    });
  });

  it('should disable filter dropdown while loading event types', () => {
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/api/admin/event-types')) {
        return new Promise(() => {}); // Never resolves
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

    const select = screen.getByRole('combobox', { name: /filter by event type/i });
    expect(select).toBeDisabled();
  });

  it('should have loading state structure', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <EventManager
        initialEvents={mockEvents}
        initialBooks={mockBooks}
      />
    );

    // Wait for event types to load
    const select = await screen.findByRole('combobox', { name: /filter by event type/i });
    await waitFor(() => {
      expect(select).not.toBeDisabled();
    });

    const selectContainer = select.parentElement;

    // Verify container has relative positioning for spinner
    expect(selectContainer).toHaveClass('relative');

    // Change filter - useTransition should handle loading state
    await user.selectOptions(select, 'MANDARIN_BOOK_CLUB');

    // Filtering should complete successfully
    await waitFor(() => {
      expect(screen.getByText('Mandarin Event 1')).toBeInTheDocument();
    });
  });
});
