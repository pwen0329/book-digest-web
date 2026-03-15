import 'server-only';

import { loadAdminDocument } from '@/lib/admin-content-store';
import { logServerEvent } from '@/lib/observability';
import eventsFallbackData from '@/data/events-content.json';
import type {
  AdminEditableLocaleText,
  EventContentId,
  EventContentMap,
  LocalizedEventContentMap,
  LocalizedEventContentRecord,
} from '@/types/event-content';

const EVENTS_CONTENT_FILE = 'data/events-content.json';
const EVENT_IDS: EventContentId[] = ['TW', 'NL', 'EN', 'DETOX'];
const EVENTS_FALLBACK = eventsFallbackData as EventContentMap;

function normalizeLocaleText(value: unknown, fallback: AdminEditableLocaleText): AdminEditableLocaleText {
  if (!value || typeof value !== 'object') {
    return fallback;
  }

  const record = value as Record<string, unknown>;
  return {
    zh: typeof record.zh === 'string' && record.zh.trim() ? record.zh : fallback.zh,
    en: typeof record.en === 'string' && record.en.trim() ? record.en : fallback.en,
  };
}

function normalizeEventRecord(value: unknown, fallback: EventContentMap[EventContentId]): EventContentMap[EventContentId] {
  if (!value || typeof value !== 'object') {
    return fallback;
  }

  const record = value as Record<string, unknown>;
  return {
    posterSrc: typeof record.posterSrc === 'string' && record.posterSrc.trim() ? record.posterSrc : fallback.posterSrc,
    posterBlurDataURL: typeof record.posterBlurDataURL === 'string' && record.posterBlurDataURL.trim() ? record.posterBlurDataURL : fallback.posterBlurDataURL,
    posterAlt: normalizeLocaleText(record.posterAlt, fallback.posterAlt),
    title: normalizeLocaleText(record.title, fallback.title),
    description: normalizeLocaleText(record.description, fallback.description),
    signupPath: typeof record.signupPath === 'string' && record.signupPath.trim() ? record.signupPath : fallback.signupPath,
    imagePosition: record.imagePosition === 'left' || record.imagePosition === 'right' ? record.imagePosition : fallback.imagePosition,
    attendanceMode: record.attendanceMode === 'offline' || record.attendanceMode === 'online' ? record.attendanceMode : fallback.attendanceMode,
    locationName: normalizeLocaleText(record.locationName, fallback.locationName),
    addressCountry: typeof record.addressCountry === 'string' && record.addressCountry.trim() ? record.addressCountry : fallback.addressCountry,
    comingSoon: typeof record.comingSoon === 'boolean' ? record.comingSoon : fallback.comingSoon,
    comingSoonBody: record.comingSoonBody ? normalizeLocaleText(record.comingSoonBody, fallback.comingSoonBody || fallback.description) : fallback.comingSoonBody,
  };
}

export function normalizeEventsContentMap(value: unknown, fallbackEvents: EventContentMap): EventContentMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    logServerEvent('warn', 'events.document_invalid_shape', { receivedType: Array.isArray(value) ? 'array' : typeof value });
    return fallbackEvents;
  }

  const record = value as Partial<Record<EventContentId, unknown>>;
  return EVENT_IDS.reduce((accumulator, eventId) => {
    accumulator[eventId] = normalizeEventRecord(record[eventId], fallbackEvents[eventId]);
    return accumulator;
  }, {} as EventContentMap);
}

export async function getEventsContent(): Promise<EventContentMap> {
  const events = await loadAdminDocument<EventContentMap>({
    key: 'events',
    fallbackFile: EVENTS_CONTENT_FILE,
  });

  return normalizeEventsContentMap(events, EVENTS_FALLBACK);
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