import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EventFilterDropdown from '@/components/admin/EventFilterDropdown';
import type { Event } from '@/types/event';

const mockEvents: Array<Pick<Event, 'id' | 'title' | 'titleEn' | 'eventDate'>> = [
  {
    id: 1,
    title: '過去的活動',
    titleEn: 'Past Event',
    eventDate: new Date('2024-01-15').toISOString(),
  },
  {
    id: 2,
    title: '最近的活動',
    titleEn: 'Recent Event',
    eventDate: new Date('2026-06-15').toISOString(),
  },
  {
    id: 3,
    title: '未來的活動',
    titleEn: 'Future Event',
    eventDate: new Date('2027-12-31').toISOString(),
  },
];

describe('EventFilterDropdown', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('Basic Rendering', () => {
    it('should render dropdown with all events', () => {
      render(
        <EventFilterDropdown
          events={mockEvents}
          value="ALL"
          onChange={mockOnChange}
        />
      );

      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();

      // Should have "All events" option + 3 events
      const options = within(select).getAllByRole('option');
      expect(options).toHaveLength(4);
    });

    it('should show "All events" option by default', () => {
      render(
        <EventFilterDropdown
          events={mockEvents}
          value="ALL"
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('All events')).toBeInTheDocument();
    });

    it('should hide "All events" option when showAllOption is false', () => {
      render(
        <EventFilterDropdown
          events={mockEvents}
          value={1}
          onChange={mockOnChange}
          showAllOption={false}
        />
      );

      expect(screen.queryByText('All events')).not.toBeInTheDocument();

      const select = screen.getByRole('combobox');
      const options = within(select).getAllByRole('option');
      expect(options).toHaveLength(3); // Only event options
    });

    it('should use custom allOptionLabel', () => {
      render(
        <EventFilterDropdown
          events={mockEvents}
          value="ALL"
          onChange={mockOnChange}
          allOptionLabel="所有活動"
        />
      );

      expect(screen.getByText('所有活動')).toBeInTheDocument();
    });
  });

  describe('Event Sorting', () => {
    it('should sort events by date (most recent first)', () => {
      render(
        <EventFilterDropdown
          events={mockEvents}
          value="ALL"
          onChange={mockOnChange}
          locale="en"
        />
      );

      const select = screen.getByRole('combobox');
      const options = within(select).getAllByRole('option');

      // Skip first option (All events)
      const eventOptions = options.slice(1);

      // Check order: Future (2027) -> Recent (2026) -> Past (2024)
      expect(eventOptions[0].textContent).toContain('Future Event');
      expect(eventOptions[1].textContent).toContain('Recent Event');
      expect(eventOptions[2].textContent).toContain('Past Event');
    });
  });

  describe('Locale Support', () => {
    it('should display Chinese titles and dates with zh locale', () => {
      render(
        <EventFilterDropdown
          events={mockEvents}
          value="ALL"
          onChange={mockOnChange}
          locale="zh"
        />
      );

      expect(screen.getByText(/過去的活動/)).toBeInTheDocument();
      expect(screen.getByText(/最近的活動/)).toBeInTheDocument();
      expect(screen.getByText(/未來的活動/)).toBeInTheDocument();
    });

    it('should display English titles with en locale', () => {
      render(
        <EventFilterDropdown
          events={mockEvents}
          value="ALL"
          onChange={mockOnChange}
          locale="en"
        />
      );

      expect(screen.getByText(/Past Event/)).toBeInTheDocument();
      expect(screen.getByText(/Recent Event/)).toBeInTheDocument();
      expect(screen.getByText(/Future Event/)).toBeInTheDocument();
    });

    it('should fallback to Chinese title if English title is missing', () => {
      const eventsWithoutEn = [
        { id: 1, title: '中文標題', titleEn: '', eventDate: new Date().toISOString() },
      ];

      render(
        <EventFilterDropdown
          events={eventsWithoutEn}
          value="ALL"
          onChange={mockOnChange}
          locale="en"
        />
      );

      expect(screen.getByText(/中文標題/)).toBeInTheDocument();
    });
  });

  describe('Completed Status', () => {
    it('should show "(complete)" for past events', () => {
      render(
        <EventFilterDropdown
          events={mockEvents}
          value="ALL"
          onChange={mockOnChange}
          showCompletedStatus={true}
          locale="en"
        />
      );

      // Past event (2024-01-15) should show (complete)
      const pastEvent = screen.getByText(/Past Event/);
      expect(pastEvent.textContent).toContain('(complete)');
    });

    it('should not show "(complete)" for future events', () => {
      render(
        <EventFilterDropdown
          events={mockEvents}
          value="ALL"
          onChange={mockOnChange}
          showCompletedStatus={true}
          locale="en"
        />
      );

      // Future event (2027-12-31) should not show (complete)
      const futureEvent = screen.getByText(/Future Event/);
      expect(futureEvent.textContent).not.toContain('(complete)');
    });

    it('should not show "(complete)" when showCompletedStatus is false', () => {
      render(
        <EventFilterDropdown
          events={mockEvents}
          value="ALL"
          onChange={mockOnChange}
          showCompletedStatus={false}
          locale="en"
        />
      );

      const pastEvent = screen.getByText(/Past Event/);
      expect(pastEvent.textContent).not.toContain('(complete)');
    });
  });

  describe('Size Variants', () => {
    it('should apply small size classes', () => {
      const { container } = render(
        <EventFilterDropdown
          events={mockEvents}
          value="ALL"
          onChange={mockOnChange}
          size="sm"
        />
      );

      const select = container.querySelector('select');
      expect(select).toHaveClass('px-4', 'py-2', 'text-sm');
    });

    it('should apply medium size classes by default', () => {
      const { container } = render(
        <EventFilterDropdown
          events={mockEvents}
          value="ALL"
          onChange={mockOnChange}
        />
      );

      const select = container.querySelector('select');
      expect(select).toHaveClass('px-4', 'py-3', 'text-base');
    });

    it('should apply large size classes', () => {
      const { container } = render(
        <EventFilterDropdown
          events={mockEvents}
          value="ALL"
          onChange={mockOnChange}
          size="lg"
        />
      );

      const select = container.querySelector('select');
      expect(select).toHaveClass('px-5', 'py-4', 'text-lg');
    });
  });

  describe('Value Handling', () => {
    it('should handle "ALL" value', () => {
      render(
        <EventFilterDropdown
          events={mockEvents}
          value="ALL"
          onChange={mockOnChange}
        />
      );

      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('ALL');
    });

    it('should handle numeric event ID value', () => {
      render(
        <EventFilterDropdown
          events={mockEvents}
          value={2}
          onChange={mockOnChange}
        />
      );

      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('2');
    });
  });

  describe('User Interactions', () => {
    it('should call onChange with "ALL" when selecting all events option', async () => {
      const user = userEvent.setup();

      render(
        <EventFilterDropdown
          events={mockEvents}
          value={1}
          onChange={mockOnChange}
        />
      );

      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'ALL');

      expect(mockOnChange).toHaveBeenCalledWith('ALL');
    });

    it('should call onChange with numeric ID when selecting an event', async () => {
      const user = userEvent.setup();

      render(
        <EventFilterDropdown
          events={mockEvents}
          value="ALL"
          onChange={mockOnChange}
        />
      );

      const select = screen.getByRole('combobox');
      await user.selectOptions(select, '2');

      expect(mockOnChange).toHaveBeenCalledWith(2);
    });

    it('should not trigger onChange when disabled', async () => {
      const user = userEvent.setup();

      render(
        <EventFilterDropdown
          events={mockEvents}
          value="ALL"
          onChange={mockOnChange}
          disabled={true}
        />
      );

      const select = screen.getByRole('combobox');
      expect(select).toBeDisabled();

      // Try to change (should not work)
      await user.selectOptions(select, '2').catch(() => {
        // Expected to fail
      });

      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });

  describe('Custom Styling', () => {
    it('should apply custom className', () => {
      const customClass = 'custom-dropdown-class';

      const { container } = render(
        <EventFilterDropdown
          events={mockEvents}
          value="ALL"
          onChange={mockOnChange}
          className={customClass}
        />
      );

      const select = container.querySelector('select');
      expect(select).toHaveClass(customClass);
    });

    it('should apply default styles when no custom className provided', () => {
      const { container } = render(
        <EventFilterDropdown
          events={mockEvents}
          value="ALL"
          onChange={mockOnChange}
        />
      );

      const select = container.querySelector('select');
      expect(select).toHaveClass('w-full', 'rounded-2xl', 'bg-black/20');
    });
  });

  describe('Empty State', () => {
    it('should render with no events', () => {
      render(
        <EventFilterDropdown
          events={[]}
          value="ALL"
          onChange={mockOnChange}
        />
      );

      const select = screen.getByRole('combobox');
      const options = within(select).getAllByRole('option');

      // Should only have "All events" option
      expect(options).toHaveLength(1);
      expect(options[0].textContent).toBe('All events');
    });
  });
});
