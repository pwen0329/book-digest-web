// Settings type - runtime configuration stored as key-value pairs

export type SettingKey =
  | 'registration_email_enabled'
  | 'maintenance_mode'
  | 'max_daily_registrations';

export type Setting = {
  key: SettingKey;
  value: any; // JSONB - type depends on the specific setting
  description: string;
  updatedAt: string;
  updatedBy?: string;
};

// Typed settings for specific keys
export type RegistrationEmailEnabled = boolean;
export type MaintenanceMode = boolean;
export type MaxDailyRegistrations = number;

// Database column names (snake_case) for Supabase queries
export type SettingRow = {
  key: string;
  value: any;
  description: string;
  updated_at: string;
  updated_by: string | null;
};

// Convert database row to application type
export function settingFromRow(row: SettingRow): Setting {
  return {
    key: row.key as SettingKey,
    value: row.value,
    description: row.description,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by ?? undefined,
  };
}

// Convert application type to database row
export function settingToRow(setting: Partial<Setting>): Partial<SettingRow> {
  const row: Partial<SettingRow> = {};
  if (setting.key !== undefined) row.key = setting.key;
  if (setting.value !== undefined) row.value = setting.value;
  if (setting.description !== undefined) row.description = setting.description;
  if (setting.updatedBy !== undefined) row.updated_by = setting.updatedBy ?? null;
  return row;
}
