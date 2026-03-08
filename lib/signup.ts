export type ClientReferral = 'BookDigestIG' | 'BookDigestFB' | 'Others';
export type ApiReferral = 'Instagram' | 'Facebook' | 'Others';

export type SignupFormValues = {
  name: string;
  age: string;
  profession: string;
  email: string;
  instagram?: string;
  referral: ClientReferral;
  referralOther?: string;
  website?: string;
};

export const EMPTY_SIGNUP_FORM_VALUES: SignupFormValues = {
  name: '',
  age: '',
  profession: '',
  email: '',
  instagram: '',
  referral: 'BookDigestIG',
  referralOther: '',
  website: '',
};

export function mapClientReferralToApi(referral: ClientReferral): ApiReferral {
  if (referral === 'BookDigestIG') return 'Instagram';
  if (referral === 'BookDigestFB') return 'Facebook';
  return 'Others';
}

export function parseApiReferral(value: unknown): ApiReferral | null {
  if (value === 'Instagram' || value === 'Facebook' || value === 'Others') {
    return value;
  }
  return null;
}

export function restoreSignupFormValues(saved: string | null) {
  if (!saved) return { ...EMPTY_SIGNUP_FORM_VALUES };

  try {
    const parsed = JSON.parse(saved) as Partial<SignupFormValues>;
    const referral = parsed.referral;

    return {
      name: typeof parsed.name === 'string' ? parsed.name : '',
      age: typeof parsed.age === 'string' ? parsed.age : '',
      profession: typeof parsed.profession === 'string' ? parsed.profession : '',
      email: typeof parsed.email === 'string' ? parsed.email : '',
      instagram: typeof parsed.instagram === 'string' ? parsed.instagram : '',
      referral: referral === 'BookDigestIG' || referral === 'BookDigestFB' || referral === 'Others' ? referral : 'BookDigestIG',
      referralOther: typeof parsed.referralOther === 'string' ? parsed.referralOther : '',
      website: '',
    };
  } catch (error) {
    console.warn('[signup] Failed to restore saved form state.', error);
    return { ...EMPTY_SIGNUP_FORM_VALUES };
  }
}