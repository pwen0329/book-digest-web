import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
  unstable_cache: (loader: (...args: unknown[]) => unknown) => loader,
}));

import { loadAdminDocument, loadAdminDocumentRecord, resetAdminDocumentSchemaFallbacksForTesting, saveAdminDocumentRecord } from '@/lib/admin-content-store';
import type { RegistrationSuccessEmailSettings } from '@/lib/registration-success-email-config';

describe('admin content store', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    resetAdminDocumentSchemaFallbacksForTesting();
  });

  it('falls back to the local JSON document when Supabase is not configured', async () => {
    vi.stubEnv('FORCE_LOCAL_PERSISTENT_STORES', '1');

    const settings = await loadAdminDocument<RegistrationSuccessEmailSettings>({
      key: 'registration-success-email',
      fallbackFile: 'data/registration-success-email.json',
    });

    expect(settings.templates.zh.subject).toContain('Book Digest');
  });

  it('prefers the remote Supabase document when persistent storage is configured', async () => {
    vi.stubEnv('FORCE_LOCAL_PERSISTENT_STORES', '0');
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ([{ value: { enabled: true, templates: { zh: { subject: '遠端設定', body: '內容' }, en: { subject: 'Remote', body: 'Body' } } } }]),
      text: async () => '',
    }));

    const settings = await loadAdminDocument<RegistrationSuccessEmailSettings>({
      key: 'registration-success-email',
      fallbackFile: 'data/registration-success-email.json',
    });

    expect(settings.enabled).toBe(true);
    expect(settings.templates.zh.subject).toBe('遠端設定');
  });

  it('reads remote admin documents without updated_at when older schema cache is still active', async () => {
    vi.stubEnv('FORCE_LOCAL_PERSISTENT_STORES', '0');
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => '{"code":"PGRST204","message":"Could not find the \'updated_at\' column of \'admin_documents\' in the schema cache"}',
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ([{ value: { enabled: true, templates: { zh: { subject: 'Legacy', body: '內容' }, en: { subject: 'Remote', body: 'Body' } } } }]),
        text: async () => '',
      }));

    const settingsRecord = await loadAdminDocumentRecord<RegistrationSuccessEmailSettings>({
      key: 'registration-success-email',
      fallbackFile: 'data/registration-success-email.json',
    });

    expect(settingsRecord.updatedAt).toBeNull();
    expect(settingsRecord.value.templates.zh.subject).toBe('Legacy');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('writes remote admin documents without requiring updated_at in the response payload', async () => {
    vi.stubEnv('FORCE_LOCAL_PERSISTENT_STORES', '0');
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');

    const settings = {
      enabled: true,
      templates: {
        zh: { subject: 'ZH', body: '內容' },
        en: { subject: 'EN', body: 'Body' },
      },
    } satisfies RegistrationSuccessEmailSettings;

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => '{"code":"PGRST204","message":"Could not find the \'updated_at\' column of \'admin_documents\' in the schema cache"}',
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ([{ value: settings }]),
        text: async () => '',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        text: async () => '',
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ([{ value: settings }]),
        text: async () => '',
      }));

    const savedRecord = await saveAdminDocumentRecord(
      { key: 'registration-success-email', fallbackFile: 'data/registration-success-email.json' },
      settings,
      null,
    );

    expect(savedRecord.value.templates.en.subject).toBe('EN');
    expect(savedRecord.updatedAt).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(4);
  });
});