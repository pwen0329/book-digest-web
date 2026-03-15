import 'server-only';

import type { NotionRegistrationRecord } from '@/lib/notion';
import { listRegistrations } from '@/lib/notion';
import type { RegistrationRecord } from '@/lib/registration-store';
import { isPersistentRegistrationStoreConfigured, listStoredRegistrations } from '@/lib/registration-store';

export type ReconciliationMismatchField =
  | 'name'
  | 'email'
  | 'location'
  | 'age'
  | 'profession'
  | 'instagram'
  | 'referral'
  | 'referralOther'
  | 'visitorId'
  | 'bankAccount';

export type ReconciliationRow = {
  kind: 'matched' | 'missing_in_notion' | 'field_mismatch';
  sourceRecord: RegistrationRecord;
  notionRecord?: NotionRegistrationRecord;
  mismatchFields: ReconciliationMismatchField[];
};

export type ReconciliationOrphanRow = {
  kind: 'missing_in_source';
  notionRecord: NotionRegistrationRecord;
};

export type ReconciliationSummary = {
  sourceOfTruth: 'supabase.registrations' | 'local-registration-store';
  notionConfigured: boolean;
  notionMirrorEnabled: boolean;
  totalSourceRecords: number;
  totalNotionRecords: number;
  matched: number;
  missingInNotion: number;
  missingInSource: number;
  mismatched: number;
  comparedAt: string;
};

export type ReconciliationReport = {
  summary: ReconciliationSummary;
  rows: ReconciliationRow[];
  notionOnlyRows: ReconciliationOrphanRow[];
};

function normalizeText(value?: string | null): string {
  return (value || '').trim();
}

function buildFallbackKey(value: { email?: string | null; location?: string | null; createdAt?: string | null; createdTime?: string | null }) {
  const email = normalizeText(value.email).toLowerCase();
  const location = normalizeText(value.location).toUpperCase();
  const timestamp = value.createdAt || value.createdTime || '';
  return `${email}::${location}::${timestamp.slice(0, 16)}`;
}

function resolveMismatchFields(source: RegistrationRecord, notion: NotionRegistrationRecord): ReconciliationMismatchField[] {
  const mismatches: ReconciliationMismatchField[] = [];

  if (normalizeText(source.name) !== normalizeText(notion.name)) mismatches.push('name');
  if (normalizeText(source.email).toLowerCase() !== normalizeText(notion.email).toLowerCase()) mismatches.push('email');
  if (normalizeText(source.location).toUpperCase() !== normalizeText(notion.location).toUpperCase()) mismatches.push('location');
  if ((source.age || null) !== notion.age) mismatches.push('age');
  if (normalizeText(source.profession) !== normalizeText(notion.occupation)) mismatches.push('profession');
  if (normalizeText(source.instagram) !== normalizeText(notion.instagram)) mismatches.push('instagram');
  if (normalizeText(source.referral) !== normalizeText(notion.findingUs)) mismatches.push('referral');
  if (normalizeText(source.referralOther) !== normalizeText(notion.findingUsOthers)) mismatches.push('referralOther');
  if (normalizeText(source.visitorId) !== normalizeText(notion.visitorId)) mismatches.push('visitorId');
  if (normalizeText(source.bankAccount) !== normalizeText(notion.bankAccount)) mismatches.push('bankAccount');

  return mismatches;
}

function findMatchingNotionRecord(source: RegistrationRecord, notionByRegistrationId: Map<string, NotionRegistrationRecord>, notionByPageId: Map<string, NotionRegistrationRecord>, notionByFallbackKey: Map<string, NotionRegistrationRecord>): NotionRegistrationRecord | undefined {
  if (source.id && notionByRegistrationId.has(source.id)) {
    return notionByRegistrationId.get(source.id);
  }

  if (source.externalId && notionByPageId.has(source.externalId)) {
    return notionByPageId.get(source.externalId);
  }

  return notionByFallbackKey.get(buildFallbackKey({ email: source.email, location: source.location, createdAt: source.createdAt }));
}

export async function buildNotionReconciliationReport(limit = 500): Promise<ReconciliationReport> {
  const notionConfigured = Boolean(process.env.NOTION_TOKEN && process.env.NOTION_DB_ID);
  const notionMirrorEnabled = process.env.SUBMIT_SAVE_TO_NOTION === '1' && notionConfigured;
  const sourceRecords = await listStoredRegistrations({ limit });
  const notionRecords = notionConfigured ? await listRegistrations(process.env.NOTION_DB_ID!, limit) : [];

  const notionByRegistrationId = new Map(notionRecords.filter((record) => record.registrationId).map((record) => [record.registrationId, record]));
  const notionByPageId = new Map(notionRecords.map((record) => [record.id, record]));
  const notionByFallbackKey = new Map(notionRecords.map((record) => [buildFallbackKey({ email: record.email, location: record.location, createdTime: record.createdTime }), record]));

  const matchedNotionIds = new Set<string>();
  const rows: ReconciliationRow[] = sourceRecords.map((sourceRecord) => {
    const notionRecord = findMatchingNotionRecord(sourceRecord, notionByRegistrationId, notionByPageId, notionByFallbackKey);
    if (!notionRecord) {
      return {
        kind: 'missing_in_notion',
        sourceRecord,
        mismatchFields: [],
      };
    }

    matchedNotionIds.add(notionRecord.id);
    const mismatchFields = resolveMismatchFields(sourceRecord, notionRecord);

    return {
      kind: mismatchFields.length ? 'field_mismatch' : 'matched',
      sourceRecord,
      notionRecord,
      mismatchFields,
    };
  });

  const notionOnlyRows: ReconciliationOrphanRow[] = notionRecords
    .filter((record) => !matchedNotionIds.has(record.id))
    .map((record) => ({ kind: 'missing_in_source', notionRecord: record }));

  return {
    summary: {
      sourceOfTruth: isPersistentRegistrationStoreConfigured() ? 'supabase.registrations' : 'local-registration-store',
      notionConfigured,
      notionMirrorEnabled,
      totalSourceRecords: sourceRecords.length,
      totalNotionRecords: notionRecords.length,
      matched: rows.filter((row) => row.kind === 'matched').length,
      missingInNotion: rows.filter((row) => row.kind === 'missing_in_notion').length,
      missingInSource: notionOnlyRows.length,
      mismatched: rows.filter((row) => row.kind === 'field_mismatch').length,
      comparedAt: new Date().toISOString(),
    },
    rows,
    notionOnlyRows,
  };
}