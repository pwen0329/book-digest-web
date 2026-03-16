import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { countActiveRegistrations, createRegistrationReservation, listStoredRegistrations, resetRegistrationStoreSchemaFallbacksForTesting, resetRegistrationsForTesting, serializeRegistrationsCsv, updateRegistrationReservation } from '@/lib/registration-store';

describe('registration store', () => {
  afterEach(async () => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    resetRegistrationStoreSchemaFallbacksForTesting();
    process.env.ALLOW_CAPACITY_RESET = '1';
    await resetRegistrationsForTesting('TW');
    await resetRegistrationsForTesting('EN');
    delete process.env.ALLOW_CAPACITY_RESET;
  });

  it('counts only active pending and confirmed registrations for capacity', async () => {
    const pending = await createRegistrationReservation({
      location: 'TW',
      locale: 'en',
      name: 'Pending Reader',
      age: 28,
      profession: 'Engineer',
      email: 'pending@example.com',
      referral: 'Instagram',
      timestamp: new Date().toISOString(),
      status: 'pending',
      source: 'pending',
    });

    await createRegistrationReservation({
      location: 'TW',
      locale: 'en',
      name: 'Confirmed Reader',
      age: 29,
      profession: 'Designer',
      email: 'confirmed@example.com',
      referral: 'Instagram',
      timestamp: new Date().toISOString(),
      status: 'confirmed',
      source: 'simulated',
    });

    await createRegistrationReservation({
      location: 'TW',
      locale: 'en',
      name: 'Cancelled Reader',
      age: 30,
      profession: 'Writer',
      email: 'cancelled@example.com',
      referral: 'Instagram',
      timestamp: new Date().toISOString(),
      status: 'cancelled',
      source: 'simulated',
    });

    expect(await countActiveRegistrations('TW')).toBe(2);

    await updateRegistrationReservation(pending.id, { status: 'cancelled' });

    expect(await countActiveRegistrations('TW')).toBe(1);
  });

  it('stores audit entries and supports createdAt filtering plus CSV export', async () => {
    const olderTimestamp = new Date('2026-03-10T08:00:00.000Z').toISOString();
    const newerTimestamp = new Date('2026-03-12T10:30:00.000Z').toISOString();

    const older = await createRegistrationReservation({
      location: 'EN',
      locale: 'en',
      name: 'Older Reader',
      age: 32,
      profession: 'Editor',
      email: 'older@example.com',
      referral: 'Instagram',
      requestId: 'req-older',
      timestamp: olderTimestamp,
      status: 'pending',
      source: 'pending',
    });

    const newer = await createRegistrationReservation({
      location: 'EN',
      locale: 'en',
      name: 'Newer Reader',
      age: 34,
      profession: 'Producer',
      email: 'newer@example.com',
      referral: 'Instagram',
      requestId: 'req-newer',
      timestamp: newerTimestamp,
      status: 'pending',
      source: 'pending',
    });

    await updateRegistrationReservation(newer.id, {
      status: 'confirmed',
      source: 'simulated',
      auditEntry: {
        at: new Date('2026-03-12T10:31:00.000Z').toISOString(),
        event: 'reservation_confirmed',
        actor: 'system',
        summary: 'Confirmed in test.',
        requestId: 'req-newer',
      },
    });

    const filtered = await listStoredRegistrations({
      limit: 10,
      location: 'EN',
      createdAfter: '2026-03-11T00:00:00.000Z',
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe(newer.id);
    expect(filtered[0].auditTrail?.map((entry) => entry.event)).toContain('reservation_created');
    expect(filtered[0].auditTrail?.map((entry) => entry.event)).toContain('reservation_confirmed');

    const csv = serializeRegistrationsCsv([older, filtered[0]]);
    expect(csv).toContain('requestId');
    expect(csv).toContain('req-newer');
    expect(csv).toContain('reservation_confirmed');
  });

  it('uses snake_case Supabase fields for active registration counts', async () => {
    vi.stubEnv('FORCE_LOCAL_PERSISTENT_STORES', '0');
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => '0-0/2' },
      json: async () => [{ id: 'reg-1' }, { id: 'reg-2' }],
      text: async () => '',
    }));

    const count = await countActiveRegistrations('DETOX');

    expect(count).toBe(2);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain('location=eq.DETOX');
    expect(String(url)).toContain('or=%28status.eq.confirmed%2Cand%28status.eq.pending%2Cupdated_at.gte.');
    expect(String(url)).not.toContain('updatedAt');
    expect(String(url)).not.toContain('orstatus');
  });

  it('orders Supabase registration lists by created_at and searches snake_case fields', async () => {
    vi.stubEnv('FORCE_LOCAL_PERSISTENT_STORES', '0');
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
      text: async () => '',
    }));

    await listStoredRegistrations({
      limit: 25,
      location: 'EN',
      status: 'confirmed',
      search: 'alice',
      createdAfter: '2026-03-01T00:00:00.000Z',
      createdBefore: '2026-03-31T23:59:59.000Z',
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain('order=created_at.desc');
    expect(String(url)).toContain('location=eq.EN');
    expect(String(url)).toContain('status=eq.confirmed');
    expect(String(url)).toContain('timestamp=gte.2026-03-01T00%3A00%3A00.000Z');
    expect(String(url)).toContain('timestamp=lte.2026-03-31T23%3A59%3A59.000Z');
    expect(String(url)).toContain('or=%28name.ilike.');
    expect(String(url)).toContain('external_id.ilike');
    expect(String(url)).toContain('request_id.ilike');
    expect(String(url)).not.toContain('createdAt');
  });

  it('retries Supabase inserts without optional columns missing from older schema caches', async () => {
    vi.stubEnv('FORCE_LOCAL_PERSISTENT_STORES', '0');
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => '{"code":"PGRST204","message":"Could not find the \'audit_trail\' column of \'registrations\' in the schema cache"}',
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => '{"code":"PGRST204","message":"Could not find the \'mirror_state\' column of \'registrations\' in the schema cache"}',
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{
          id: 'legacy-reg',
          location: 'EN',
          locale: 'en',
          name: 'Legacy Reader',
          age: 33,
          profession: 'Engineer',
          email: 'legacy@example.com',
          referral: 'Instagram',
          timestamp: '2026-03-16T11:00:00.000Z',
          status: 'pending',
          source: 'pending',
          created_at: '2026-03-16T11:00:00.000Z',
          updated_at: '2026-03-16T11:00:00.000Z',
        }],
      }));

    const created = await createRegistrationReservation({
      location: 'EN',
      locale: 'en',
      name: 'Legacy Reader',
      age: 33,
      profession: 'Engineer',
      email: 'legacy@example.com',
      referral: 'Instagram',
      timestamp: '2026-03-16T11:00:00.000Z',
      status: 'pending',
      source: 'pending',
    });

    expect(created.id).toBe('legacy-reg');
    expect(fetch).toHaveBeenCalledTimes(3);

    const firstBody = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body));
    const secondBody = JSON.parse(String(vi.mocked(fetch).mock.calls[1]?.[1]?.body));
    const thirdBody = JSON.parse(String(vi.mocked(fetch).mock.calls[2]?.[1]?.body));

    expect(firstBody[0]).toHaveProperty('audit_trail');
    expect(firstBody[0]).toHaveProperty('mirror_state');
    expect(secondBody[0]).not.toHaveProperty('audit_trail');
    expect(secondBody[0]).toHaveProperty('mirror_state');
    expect(thirdBody[0]).not.toHaveProperty('audit_trail');
    expect(thirdBody[0]).not.toHaveProperty('mirror_state');
  });

  it('retries Supabase updates without optional columns missing from older schema caches', async () => {
    vi.stubEnv('FORCE_LOCAL_PERSISTENT_STORES', '0');
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{
          id: 'legacy-reg',
          location: 'EN',
          locale: 'en',
          name: 'Legacy Reader',
          age: 33,
          profession: 'Engineer',
          email: 'legacy@example.com',
          referral: 'Instagram',
          timestamp: '2026-03-16T11:00:00.000Z',
          status: 'pending',
          source: 'pending',
          created_at: '2026-03-16T11:00:00.000Z',
          updated_at: '2026-03-16T11:00:00.000Z',
        }],
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => '{"code":"PGRST204","message":"Could not find the \'request_id\' column of \'registrations\' in the schema cache"}',
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{
          id: 'legacy-reg',
          location: 'EN',
          locale: 'en',
          name: 'Legacy Reader',
          age: 33,
          profession: 'Engineer',
          email: 'legacy@example.com',
          referral: 'Instagram',
          timestamp: '2026-03-16T11:00:00.000Z',
          status: 'confirmed',
          source: 'simulated',
          created_at: '2026-03-16T11:00:00.000Z',
          updated_at: '2026-03-16T11:05:00.000Z',
        }],
      }));

    const updated = await updateRegistrationReservation('legacy-reg', {
      status: 'confirmed',
      source: 'simulated',
      requestId: 'req-legacy',
      auditEntry: {
        at: '2026-03-16T11:05:00.000Z',
        event: 'reservation_confirmed',
        actor: 'system',
        summary: 'Confirmed on legacy schema.',
      },
    });

    expect(updated?.status).toBe('confirmed');
    expect(fetch).toHaveBeenCalledTimes(3);

    const firstPatchBody = JSON.parse(String(vi.mocked(fetch).mock.calls[1]?.[1]?.body));
    const secondPatchBody = JSON.parse(String(vi.mocked(fetch).mock.calls[2]?.[1]?.body));

    expect(firstPatchBody).toHaveProperty('request_id');
    expect(secondPatchBody).not.toHaveProperty('request_id');
  });
});