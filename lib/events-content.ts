import 'server-only';

import { loadAdminDocument } from '@/lib/admin-content-store';
import type {
  EventContentId,
  EventContentMap,
  LocalizedEventContentMap,
  LocalizedEventContentRecord,
} from '@/types/event-content';

const EVENTS_CONTENT_FILE = 'data/events-content.json';

export async function getEventsContent(): Promise<EventContentMap> {
  return loadAdminDocument<EventContentMap>({
    key: 'events',
    fallbackFile: EVENTS_CONTENT_FILE,
  });
}

export async function getEventContent(eventId: EventContentId) {
  const events = await getEventsContent();
  return events[eventId];
}

export async function getLocalizedEventsContent(locale: string): Promise<LocalizedEventContentMap> {
  const language = locale === 'en' ? 'en' : 'zh';
  const events = await getEventsContent();

  return (Object.entries(events) as Array<[EventContentId, EventContentMap[EventContentId]]>).reduce(
    (accumulator, [eventId, event]) => {
      const localizedRecord: LocalizedEventContentRecord = {
        id: eventId,
        posterSrc: event.posterSrc,
        posterBlurDataURL: event.posterBlurDataURL,
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

export async function getLocalizedEventContent(locale: string, eventId: EventContentId): Promise<LocalizedEventContentRecord> {
  const events = await getLocalizedEventsContent(locale);
  return events[eventId];
}