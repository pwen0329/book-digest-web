import 'server-only';

import { loadAdminDocument } from '@/lib/admin-content-store';

export type SignupLocation = 'TW' | 'NL' | 'EN' | 'DETOX';

export type CapacityConfigSlot = {
  enabled?: boolean;
  forceFull?: boolean;
  startAt?: string;
  endAt?: string;
  max?: number;
};

export type CapacityConfigFile = Partial<Record<SignupLocation, CapacityConfigSlot>>;

const SIGNUP_CAPACITY_FILE = 'data/signup-capacity.json';

export async function getSignupCapacityConfig(): Promise<CapacityConfigFile> {
  return loadAdminDocument<CapacityConfigFile>({
    key: 'capacity',
    fallbackFile: SIGNUP_CAPACITY_FILE,
  });
}

export async function getSignupCapacitySlot(location: SignupLocation): Promise<CapacityConfigSlot> {
  const config = await getSignupCapacityConfig();
  return config[location] || {};
}