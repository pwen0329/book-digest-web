import 'server-only';

// Shared Supabase utility functions for direct REST API access

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getSupabaseUrl(): string {
  const url = process.env.SUPABASE_URL;
  if (!url) {
    throw new Error('SUPABASE_URL is not configured.');
  }
  return url;
}

export function getSupabaseServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured.');
  }
  return key;
}

export function getSupabaseHeaders(extraHeaders?: Record<string, string>): HeadersInit {
  const key = getSupabaseServiceRoleKey();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    ...extraHeaders,
  };
}

export function getTableUrl(tableName: string): string {
  return `${getSupabaseUrl()}/rest/v1/${tableName}`;
}

// Generic CRUD operations

export async function fetchRows<T>(
  tableName: string,
  query: string = '*',
  filter?: string
): Promise<T[]> {
  const url = filter
    ? `${getTableUrl(tableName)}?select=${query}&${filter}`
    : `${getTableUrl(tableName)}?select=${query}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: getSupabaseHeaders(),
    cache: 'no-store',
  });

  if (!response.ok) {
    const reason = await response.text().catch(() => 'unknown');
    throw new Error(`Failed to fetch from ${tableName}: ${response.status} ${reason}`);
  }

  return (await response.json()) as T[];
}

export async function fetchSingleRow<T>(
  tableName: string,
  query: string = '*',
  filter: string
): Promise<T | null> {
  const rows = await fetchRows<T>(tableName, query, filter);
  return rows.length > 0 ? rows[0] : null;
}

export async function insertRow<T>(
  tableName: string,
  data: Record<string, unknown>
): Promise<T> {
  const response = await fetch(getTableUrl(tableName), {
    method: 'POST',
    headers: getSupabaseHeaders({ Prefer: 'return=representation' }),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const reason = await response.text().catch(() => 'unknown');
    throw new Error(`Failed to insert into ${tableName}: ${response.status} ${reason}`);
  }

  const rows = (await response.json()) as T[];
  if (rows.length === 0) {
    throw new Error(`Insert into ${tableName} returned no data`);
  }

  return rows[0];
}

export async function updateRow<T>(
  tableName: string,
  filter: string,
  data: Record<string, unknown>
): Promise<T> {
  const response = await fetch(`${getTableUrl(tableName)}?${filter}`, {
    method: 'PATCH',
    headers: getSupabaseHeaders({ Prefer: 'return=representation' }),
    body: JSON.stringify({ ...data, updated_at: new Date().toISOString() }),
  });

  if (!response.ok) {
    const reason = await response.text().catch(() => 'unknown');
    throw new Error(`Failed to update ${tableName}: ${response.status} ${reason}`);
  }

  const rows = (await response.json()) as T[];
  if (rows.length === 0) {
    throw new Error(`Update in ${tableName} returned no data`);
  }

  return rows[0];
}

export async function deleteRow(tableName: string, filter: string): Promise<void> {
  const response = await fetch(`${getTableUrl(tableName)}?${filter}`, {
    method: 'DELETE',
    headers: getSupabaseHeaders(),
  });

  if (!response.ok) {
    const reason = await response.text().catch(() => 'unknown');
    throw new Error(`Failed to delete from ${tableName}: ${response.status} ${reason}`);
  }
}

export async function countRows(tableName: string, filter?: string): Promise<number> {
  const url = filter
    ? `${getTableUrl(tableName)}?select=count&${filter}`
    : `${getTableUrl(tableName)}?select=count`;

  const response = await fetch(url, {
    method: 'HEAD',
    headers: getSupabaseHeaders({ Prefer: 'count=exact' }),
  });

  if (!response.ok) {
    const reason = await response.text().catch(() => 'unknown');
    throw new Error(`Failed to count rows in ${tableName}: ${response.status} ${reason}`);
  }

  const countHeader = response.headers.get('content-range');
  if (!countHeader) {
    throw new Error(`No content-range header in count response from ${tableName}`);
  }

  // Content-Range format: "0-24/3573" or "*/0"
  const match = countHeader.match(/\/(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}
