import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ActivitySignupFlow from '@/components/ActivitySignupFlow';

vi.mock('next/image', () => ({
  default: ({ alt, blurDataURL: _blurDataURL, fill: _fill, placeholder: _placeholder, priority: _priority, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & {
    blurDataURL?: string;
    fill?: boolean;
    placeholder?: string;
    priority?: boolean;
  }) => <img {...props} alt={alt || ''} />,
}));

vi.mock('next/link', () => ({
  default: ({ children, href, prefetch: _prefetch, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; prefetch?: boolean }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock('@/components/Turnstile', () => ({
  default: ({ onVerify }: { onVerify?: (token: string) => void }) => (
    <button type="button" onClick={() => onVerify?.('turnstile-token')}>
      Verify human
    </button>
  ),
}));

const messages = {
  events: {
    backToEvents: 'Back to events',
    signUp: 'Sign Up',
    taiwanTitle: 'Taiwan Book Club',
    onlineTitle: 'English Book Club',
    nlTitle: 'Book Club in the Netherlands',
    detoxTitle: 'Unplug Project',
    taiwan: 'Taiwan',
    english: 'English',
    netherlands: 'Netherlands',
  },
  form: {
    success: 'Success',
    error: 'Error',
    nameLabel: "Hi, what's your name?",
    ageLabel: 'How old are you?',
    professionLabel: 'What do you do?',
    emailLabel: 'Email',
    instagramLabel: 'Instagram',
    referralLabel: 'How did you hear about us?',
    referralBookDigestIG: 'Book Digest Instagram',
    referralBookDigestFB: 'Book Digest Facebook',
    referralOthers: 'Others',
    referralOtherLabel: 'Please specify',
    referralOtherPlaceholder: 'Tell us more',
    submit: 'Sign Up',
    submitting: 'Submitting...',
  },
  signupFlow: {
    thanksTitle: 'Thanks!',
    thanksBody: 'Your spot is almost secured.',
    next: 'Next',
    checkingAvailability: 'Checking availability...',
    remitTitle: 'Payment Details',
    bank: 'Bank: Test Bank',
    account: 'Account: 123',
    richartPrefix: 'Richart',
    richartLinkText: 'Open Richart',
    remitPrompt: 'Fill in your remittance code.',
    last5Label: 'Last 5 digits',
    last5Placeholder: '12345',
    last5Error: 'Please enter exactly 5 digits',
    submitting: 'Submitting...',
    submitPayment: 'Submit',
    genericError: 'Something went wrong.',
    fullTitle: 'Registration Full',
    fullBody: 'This session has reached capacity.',
    closedTitle: 'Registration Closed',
    closedBody: 'Registration is currently closed.',
    slotCheckError: 'Could not check availability.',
    successTitle: 'Registration Successful!',
    successBody: 'Confirmation is on the way.',
    cancelTitle: '',
    cancelBody: '',
    contact: '',
  },
  detoxSignupFlow: {
    thanksTitle: 'THANKS FOR YOUR INTEREST!',
    thanksBody: 'The registration fee for this event is NT$850.',
    next: 'Next',
    checkingAvailability: 'Checking availability...',
    remitTitle: 'Payment Details',
    bank: 'Bank: Taishin Bank (812)',
    account: 'Account: 2888-1006-7763-04',
    richartPrefix: 'Open Richart',
    richartLinkText: 'Open Richart',
    remitPrompt: 'After you transfer, fill in the last 5 digits.',
    last5Label: 'Last 5 digits of remittance',
    last5Placeholder: '12345',
    last5Error: 'Please enter exactly 5 digits',
    submitting: 'Submitting...',
    submitPayment: 'Submit',
    genericError: 'Something went wrong. Please try again later.',
    fullTitle: 'Registration Full',
    fullBody: 'This session has reached its capacity. Please watch our next event announcement.',
    closedTitle: 'Registration Closed',
    closedBody: 'Registration is currently closed for this time slot.',
    slotCheckError: 'We could not check availability right now.',
    successTitle: 'Registration Successful!',
    successBody: "We'll see you at the dungeon gate!",
    cancelTitle: '',
    cancelBody: '',
    contact: '',
  },
} as const;

type MessageNamespaces = typeof messages;

function createTranslator<Namespace extends keyof MessageNamespaces>(namespace: Namespace) {
  const values = messages[namespace];
  return (key: string) => values[key as keyof typeof values] ?? `${String(namespace)}.${key}`;
}

const translators: { [Key in keyof MessageNamespaces]: (key: string) => string } = {
  events: createTranslator('events'),
  form: createTranslator('form'),
  signupFlow: createTranslator('signupFlow'),
  detoxSignupFlow: createTranslator('detoxSignupFlow'),
};

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: (namespace: keyof typeof messages) => translators[namespace],
}));

function createJsonResponse(payload: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => payload,
  } as Response;
}

describe('ActivitySignupFlow', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    window.sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders the shared signup form when capacity is open', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(createJsonResponse({
      enabled: true,
      open: true,
      full: false,
      count: 3,
      max: 18,
      reason: 'ok',
    }));

    render(
      <ActivitySignupFlow
        activeTab="TW"
        location="TW"
        posterSrc="/poster.jpg"
        posterAlt="Poster"
        translationNamespace="signupFlow"
      />,
    );

    expect(screen.getByText('Checking availability...')).toBeInTheDocument();
    await screen.findByLabelText("Hi, what's your name?");
    const fetchMock = vi.mocked(fetch);
    const [statusUrl, statusOptions] = fetchMock.mock.calls[0];
    expect(String(statusUrl)).toContain('/api/submit?loc=TW');
    expect(String(statusUrl)).toContain('&_=');
    expect(statusOptions).toMatchObject({ method: 'GET' });
  });

  it('shows the blocked state when the session is full', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(createJsonResponse({
      enabled: true,
      open: true,
      full: true,
      count: 18,
      max: 18,
      reason: 'full',
    }));

    render(
      <ActivitySignupFlow
        activeTab="DETOX"
        location="DETOX"
        posterSrc="/poster.jpg"
        posterAlt="Poster"
        translationNamespace="detoxSignupFlow"
      />,
    );

    await screen.findByText('Registration Full');
    expect(screen.getByText('This session has reached its capacity. Please watch our next event announcement.')).toBeInTheDocument();
    expect(screen.queryByLabelText("Hi, what's your name?")).not.toBeInTheDocument();
  });

  it('advances through the detox wizard and submits payment details', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(createJsonResponse({
        enabled: true,
        open: true,
        full: false,
        count: 2,
        max: 18,
        reason: 'ok',
      }))
      .mockResolvedValueOnce(createJsonResponse({ ok: true }));

    const user = userEvent.setup();

    render(
      <ActivitySignupFlow
        activeTab="DETOX"
        location="DETOX"
        posterSrc="/poster.jpg"
        posterAlt="Poster"
        translationNamespace="detoxSignupFlow"
      />,
    );

    await user.type(await screen.findByLabelText("Hi, what's your name?"), 'Detox Adventurer');
    await user.type(screen.getByLabelText('How old are you?'), '28');
    await user.type(screen.getByLabelText('What do you do?'), 'Designer');
    await user.type(screen.getByLabelText('Email'), 'detox@example.com');
    await user.click(screen.getByRole('button', { name: 'Sign Up' }));

    await screen.findByText('THANKS FOR YOUR INTEREST!');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Payment Details');
    await user.type(screen.getByLabelText('Last 5 digits of remittance'), '12345');
    await user.click(screen.getByRole('button', { name: 'Verify human' }));
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    await screen.findByText('Registration Successful!');
    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        '/api/submit?loc=DETOX',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.any(String),
        }),
      );
    });

    const submitBody = JSON.parse(fetchMock.mock.calls[1][1]?.body as string) as Record<string, unknown>;
    expect(submitBody).toMatchObject({
      location: 'DETOX',
      locale: 'en',
      name: 'Detox Adventurer',
      age: 28,
      profession: 'Designer',
      email: 'detox@example.com',
      referral: 'Instagram',
      bankAccount: '12345',
      turnstileToken: 'turnstile-token',
    });
  });

  it('blocks finalize when remittance code is not exactly 5 digits', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(createJsonResponse({
      enabled: true,
      open: true,
      full: false,
      count: 1,
      max: 18,
      reason: 'ok',
    }));

    const user = userEvent.setup();

    render(
      <ActivitySignupFlow
        activeTab="DETOX"
        location="DETOX"
        posterSrc="/poster.jpg"
        posterAlt="Poster"
        translationNamespace="detoxSignupFlow"
      />,
    );

    await user.type(await screen.findByLabelText("Hi, what's your name?"), 'Detox Adventurer');
    await user.type(screen.getByLabelText('How old are you?'), '28');
    await user.type(screen.getByLabelText('What do you do?'), 'Designer');
    await user.type(screen.getByLabelText('Email'), 'detox@example.com');
    await user.click(screen.getByRole('button', { name: 'Sign Up' }));

    await screen.findByText('THANKS FOR YOUR INTEREST!');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Payment Details');
    await user.type(screen.getByLabelText('Last 5 digits of remittance'), '1234');
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(await screen.findByText('Please enter exactly 5 digits')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});