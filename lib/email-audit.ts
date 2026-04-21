import 'server-only';
import { fetchRows, getTableUrl, getSupabaseHeaders } from '@/lib/supabase-utils';

// ============================================================================
// Types
// ============================================================================

export type EmailAuditRow = {
  id: string;
  sent_at: string;
  recipient_email: string;
  email_type: 'reservation_confirmation' | 'payment_confirmation' | 'test';
  status: 'sent' | 'failed' | 'skipped';
  registration_id: string | null;
  event_id: number | null;
  locale: string;
  subject: string | null;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type EmailHistoryEntry = {
  id: string;
  sentAt: string;
  recipientEmail: string;
  emailType: 'reservation_confirmation' | 'payment_confirmation' | 'test';
  status: 'sent' | 'failed' | 'skipped';
  eventId: number | null;
  eventTitle: string | null;
  registrationId: string | null;
  locale: string;
  subject: string | null;
  errorMessage: string | null;
};

export type EmailHistoryFilters = {
  limit?: number;
  offset?: number;
  type?: 'reservation_confirmation' | 'payment_confirmation' | 'test';
  search?: string;
  eventId?: number;
};

export type EmailHistoryResult = {
  emails: EmailHistoryEntry[];
  total: number;
};

// ============================================================================
// Email Audit Functions
// ============================================================================

export async function getEmailHistory(filters: EmailHistoryFilters = {}): Promise<EmailHistoryResult> {
  const { limit = 50, offset = 0, type, search, eventId } = filters;

  // Build query with left join to events table for event titles
  const query = `
    id,
    sent_at,
    recipient_email,
    email_type,
    status,
    event_id,
    registration_id,
    locale,
    subject,
    error_message,
    events(id,title)
  `.replace(/\s+/g, '');

  // Build filter string
  const filterParts: string[] = [
    `order=sent_at.desc`,
    `limit=${limit}`,
    `offset=${offset}`,
  ];

  if (type) {
    filterParts.push(`email_type=eq.${type}`);
  }

  if (eventId) {
    filterParts.push(`event_id=eq.${eventId}`);
  }

  // Add search filter for recipient_email or subject
  if (search && search.trim()) {
    const searchTerm = search.trim();
    // Use Supabase "or" filter to search in both fields
    // Format: or=(recipient_email.ilike.*term*,subject.ilike.*term*)
    filterParts.push(`or=(recipient_email.ilike.*${searchTerm}*,subject.ilike.*${searchTerm}*)`);
  }

  const filterString = filterParts.join('&');

  // Fetch rows
  const rows = await fetchRows<EmailAuditRow & { events: { id: number; title: string } | null }>(
    'email_audit',
    query,
    filterString
  );

  // Also get total count
  const totalCount = await getEmailHistoryCount(type, search, eventId);

  // Transform rows
  const emails: EmailHistoryEntry[] = rows.map(row => ({
    id: row.id,
    sentAt: row.sent_at,
    recipientEmail: row.recipient_email,
    emailType: row.email_type,
    status: row.status,
    eventId: row.event_id,
    eventTitle: row.events?.title || null,
    registrationId: row.registration_id,
    locale: row.locale,
    subject: row.subject,
    errorMessage: row.error_message,
  }));

  return {
    emails,
    total: totalCount,
  };
}

async function getEmailHistoryCount(type?: string, search?: string, eventId?: number): Promise<number> {
  let url = `${getTableUrl('email_audit')}?select=count`;

  const filterParts: string[] = [];

  if (type) {
    filterParts.push(`email_type=eq.${type}`);
  }

  if (eventId) {
    filterParts.push(`event_id=eq.${eventId}`);
  }

  if (search && search.trim()) {
    const searchTerm = search.trim();
    filterParts.push(`or=(recipient_email.ilike.*${searchTerm}*,subject.ilike.*${searchTerm}*)`);
  }

  if (filterParts.length > 0) {
    url = `${url}&${filterParts.join('&')}`;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      ...getSupabaseHeaders(),
      Prefer: 'count=exact',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get email history count: ${response.statusText}`);
  }

  const countHeader = response.headers.get('content-range');
  if (!countHeader) {
    return 0;
  }

  // Content-Range header format: "0-49/100" or "*/100"
  const match = countHeader.match(/\/(\d+)$/);
  return match ? Number.parseInt(match[1], 10) : 0;
}
