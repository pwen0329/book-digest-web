import type { Event } from '@/types/event';

/**
 * Required event fields for the filter dropdown
 * This ensures compile-time safety - you cannot pass events without these fields
 */
export type EventFilterItem = Pick<Event, 'id' | 'title' | 'eventDate'> & {
  titleEn?: string | null;
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
