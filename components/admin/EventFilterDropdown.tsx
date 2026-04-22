'use client';

import type { Event } from '@/types/event';

/** Value type for the event filter - either a specific event ID or 'ALL' for all events */
type EventFilterValue = number | 'ALL';

/**
 * Required event fields for the filter dropdown
 * This ensures compile-time safety - you cannot pass events without these fields
 *
 * Export this type so consumers can use it in their own type definitions
 */
export type EventFilterItem = Pick<Event, 'id' | 'title' | 'eventDate'> & {
  titleEn?: string | null;
};

type EventFilterDropdownProps = {
  /** Array of events to display in the dropdown. Must include id, title, titleEn, and eventDate */
  events: readonly EventFilterItem[];
  /** Current selected value - can be a number (event ID) or 'ALL' */
  value: EventFilterValue;
  /** Callback when selection changes */
  onChange: (value: EventFilterValue) => void;
  /** Whether the dropdown is disabled */
  disabled?: boolean;
  /** Custom CSS classes to override default styling */
  className?: string;
  /** Size variant for different contexts */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show the "All events" option at the top */
  showAllOption?: boolean;
  /** Custom label for the "All events" option */
  allOptionLabel?: string;
  /** Locale for date formatting and title selection */
  locale?: 'zh' | 'en';
  /** Whether to show "(complete)" suffix for past events */
  showCompletedStatus?: boolean;
};

/**
 * Helper function to prepare events for the filter dropdown
 * This provides an additional layer of type safety and makes it clear what fields are needed
 *
 * @example
 * const filterEvents = prepareEventsForFilter(allEvents);
 * <EventFilterDropdown events={filterEvents} ... />
 */
export function prepareEventsForFilter(
  events: readonly Event[]
): EventFilterItem[] {
  return events.map((event) => ({
    id: event.id,
    title: event.title,
    titleEn: event.titleEn,
    eventDate: event.eventDate,
  }));
}

/**
 * Reusable event filter dropdown component for admin pages
 *
 * Features:
 * - Displays events sorted by date (most recent first)
 * - Shows date + title + completion status
 * - Consistent styling across admin pages
 * - Supports different value types (number, 'ALL', null)
 * - Configurable locale for date formatting and event titles
 *
 * @example
 * // Basic usage with 'ALL' option
 * <EventFilterDropdown
 *   events={events}
 *   value={selectedEventId}
 *   onChange={setSelectedEventId}
 * />
 *
 * @example
 * // With null as "all" value
 * <EventFilterDropdown
 *   events={events}
 *   value={selectedEventId}
 *   onChange={setSelectedEventId}
 *   showAllOption={true}
 * />
 *
 * @example
 * // English locale with small size
 * <EventFilterDropdown
 *   events={events}
 *   value={selectedEventId}
 *   onChange={setSelectedEventId}
 *   locale="en"
 *   size="sm"
 * />
 */
export default function EventFilterDropdown({
  events,
  value,
  onChange,
  disabled = false,
  className,
  size = 'md',
  showAllOption = true,
  allOptionLabel = 'All events',
  locale = 'zh',
  showCompletedStatus = true,
}: EventFilterDropdownProps) {
  // Sort events by date (most recent first)
  const sortedEvents = [...events].sort(
    (a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime()
  );

  // Determine size-specific styles
  const sizeClasses = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-4 py-3 text-base',
    lg: 'px-5 py-4 text-lg',
  };

  // Handle change event
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value;
    if (newValue === 'ALL') {
      onChange('ALL');
    } else {
      onChange(parseInt(newValue, 10));
    }
  };

  // Convert value to string for select element
  const selectValue = value.toString();

  // Get date formatter based on locale
  const dateFormatOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  };
  const dateLocale = locale === 'zh' ? 'zh-TW' : 'en-US';

  return (
    <select
      value={selectValue}
      onChange={handleChange}
      disabled={disabled}
      className={
        className ||
        `w-full rounded-2xl bg-black/20 outline-none focus:ring-2 focus:ring-brand-pink/40 ${sizeClasses[size]}`
      }
    >
      {showAllOption && (
        <option value="ALL">
          {allOptionLabel}
        </option>
      )}
      {sortedEvents.map((event) => {
        const eventDate = new Date(event.eventDate);
        const isComplete = showCompletedStatus && eventDate < new Date();
        const dateStr = eventDate.toLocaleDateString(dateLocale, dateFormatOptions);
        const title = locale === 'en' ? (event.titleEn || event.title) : event.title;

        return (
          <option
            key={event.id}
            value={event.id}
            style={{ color: isComplete ? '#888' : undefined }}
          >
            {dateStr} {title}{isComplete ? ' (complete)' : ''}
          </option>
        );
      })}
    </select>
  );
}
