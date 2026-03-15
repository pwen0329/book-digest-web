export type AdminEditableLocaleText = {
  zh: string;
  en: string;
};

export type EventContentId = 'TW' | 'NL' | 'EN' | 'DETOX';

export type EventContentRecord = {
  posterSrc: string;
  posterBlurDataURL?: string;
  posterAlt: AdminEditableLocaleText;
  title: AdminEditableLocaleText;
  description: AdminEditableLocaleText;
  signupPath: string;
  imagePosition: 'left' | 'right';
  attendanceMode: 'offline' | 'online';
  locationName: AdminEditableLocaleText;
  addressCountry?: string;
  comingSoon?: boolean;
  comingSoonBody?: AdminEditableLocaleText;
};

export type EventContentMap = Record<EventContentId, EventContentRecord>;

export type LocalizedEventContentRecord = {
  id: EventContentId;
  posterSrc: string;
  posterBlurDataURL?: string;
  posterAlt: string;
  title: string;
  description: string;
  signupPath: string;
  imagePosition: 'left' | 'right';
  attendanceMode: 'offline' | 'online';
  locationName: string;
  addressCountry?: string;
  comingSoon: boolean;
  comingSoonBody?: string;
};

export type LocalizedEventContentMap = Record<EventContentId, LocalizedEventContentRecord>;