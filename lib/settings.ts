import 'server-only';

import type { Setting, SettingKey, SettingRow } from '@/types/settings';
import { settingFromRow, settingToRow } from '@/types/settings';
import {
  fetchRows,
  fetchSingleRow,
  updateRow,
  insertRow,
} from '@/lib/supabase-utils';

const TABLE_NAME = process.env.SUPABASE_SETTINGS_TABLE || 'settings';

// Get all settings
export async function getAllSettings(): Promise<Setting[]> {
  const rows = await fetchRows<SettingRow>(TABLE_NAME, '*', 'order=key.asc');
  return rows.map(settingFromRow);
}

// Get setting by key
export async function getSetting(key: SettingKey): Promise<Setting | null> {
  const row = await fetchSingleRow<SettingRow>(TABLE_NAME, '*', `key=eq.${encodeURIComponent(key)}`);
  return row ? settingFromRow(row) : null;
}

// Get setting value (typed)
export async function getSettingValue<T = unknown>(key: SettingKey): Promise<T | null> {
  const setting = await getSetting(key);
  return setting ? (setting.value as T) : null;
}

// Update or insert setting
export async function upsertSetting(
  key: SettingKey,
  value: unknown,
  description: string,
  updatedBy?: string
): Promise<Setting> {
  const data = settingToRow({ key, value, description, updatedBy });

  // Try update first
  try {
    const result = await updateRow<SettingRow>(TABLE_NAME, `key=eq.${encodeURIComponent(key)}`, {
      ...data,
      updated_at: new Date().toISOString(),
    });
    return settingFromRow(result);
  } catch {
    // If update returns no rows, insert instead
    const result = await insertRow<SettingRow>(TABLE_NAME, { ...data, key });
    return settingFromRow(result);
  }
}

// Convenience functions for common settings

export async function isRegistrationEmailEnabled(): Promise<boolean> {
  const value = await getSettingValue<boolean>('registration_email_enabled');
  return value ?? false;
}

export async function isMaintenanceMode(): Promise<boolean> {
  const value = await getSettingValue<boolean>('maintenance_mode');
  return value ?? false;
}

export async function getMaxDailyRegistrations(): Promise<number> {
  const value = await getSettingValue<number>('max_daily_registrations');
  return value ?? 50;
}
