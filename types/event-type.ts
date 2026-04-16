// Event type reference - bilingual names for event categories

export type EventType = {
  code: string;
  nameEn: string;
  nameZh: string;
};

// Database row type
export type EventTypeRow = {
  code: string;
  name_en: string;
  name_zh: string;
};

// Convert database row to application type
export function eventTypeFromRow(row: EventTypeRow): EventType {
  return {
    code: row.code,
    nameEn: row.name_en,
    nameZh: row.name_zh,
  };
}
