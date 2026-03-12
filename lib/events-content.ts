import 'server-only';

import { readJsonFile } from '@/lib/json-store';
import type {
  EventContentId,
  EventContentMap,
  LocalizedEventContentMap,
  LocalizedEventContentRecord,
} from '@/types/event-content';

const EVENTS_CONTENT_FILE = 'data/events-content.json';

export function getEventsContent(): EventContentMap {
  return readJsonFile<EventContentMap>(EVENTS_CONTENT_FILE);
}

export function getEventContent(eventId: EventContentId) {
  return getEventsContent()[eventId];
}

export function getLocalizedEventsContent(locale: string): LocalizedEventContentMap {
  const language = locale === 'en' ? 'en' : 'zh';
  const events = getEventsContent();

  return (Object.entries(events) as Array<[EventContentId, EventContentMap[EventContentId]]>).reduce(
    (accumulator, [eventId, event]) => {
      const localizedRecord: LocalizedEventContentRecord = {
        id: eventId,
        posterSrc: event.posterSrc,
        posterAlt: event.posterAlt[language],
        title: event.title[language],
        description: event.description[language],
        signupPath: event.signupPath,
        imagePosition: event.imagePosition,
        attendanceMode: event.attendanceMode,
        locationName: event.locationName[language],
        addressCountry: event.addressCountry,
        comingSoon: event.comingSoon === true,
        comingSoonBody: event.comingSoonBody?.[language],
      };

      accumulator[eventId] = localizedRecord;
      return accumulator;
    },
    {} as LocalizedEventContentMap
  );
}

export function getLocalizedEventContent(locale: string, eventId: EventContentId): LocalizedEventContentRecord {
  return getLocalizedEventsContent(locale)[eventId];
}