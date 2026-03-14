import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { countActiveRegistrations, createRegistrationReservation, resetRegistrationsForTesting, updateRegistrationReservation } from '@/lib/registration-store';

describe('registration store', () => {
  afterEach(async () => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
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
});