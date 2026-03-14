import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { loadAdminDocument } from '@/lib/admin-content-store';
import type { RegistrationSuccessEmailSettings } from '@/lib/registration-success-email-config';

describe('admin content store', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('falls back to the local JSON document when Supabase is not configured', async () => {
    const settings = await loadAdminDocument<RegistrationSuccessEmailSettings>({
      key: 'registration-success-email',
      fallbackFile: 'data/registration-success-email.json',
    });

    expect(settings.templates.zh.subject).toContain('Book Digest');
  });

  it('prefers the remote Supabase document when persistent storage is configured', async () => {
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
});