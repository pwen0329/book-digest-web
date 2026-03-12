import 'server-only';

import { readJsonFile } from '@/lib/json-store';

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

export function getSignupCapacityConfig(): CapacityConfigFile {
  return readJsonFile<CapacityConfigFile>(SIGNUP_CAPACITY_FILE);
}

export function getSignupCapacitySlot(location: SignupLocation): CapacityConfigSlot {
  return getSignupCapacityConfig()[location] || {};
}