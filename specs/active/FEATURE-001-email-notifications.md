# FEATURE-001: Email Notifications System

**Status**: Draft  
**Created**: 2026-04-17  
**Author**: Engineering Team  
**Epic**: Email & Communication

## Overview

### Summary
Implement comprehensive email notification system with two types of emails:
1. **Reservation Confirmation Email** (optional, admin-controlled): Sent when user registers, notifying them registration received and awaiting payment review
2. **Payment Confirmation Email** (always on): Sent when admin confirms payment, notifying user their reservation is confirmed

The feature includes an admin payment review workflow where admins can confirm or reject payments with reasons, and an admin email management page to control settings, send test emails, and view email history.

### Business Value
- **User experience**: Automatic confirmation emails reduce uncertainty and support inquiries
- **Admin efficiency**: Centralized payment review workflow with one-click confirmation
- **Compliance**: Email audit trail for debugging and customer support
- **Flexibility**: Toggle reservation emails on/off based on operational needs

### Dependencies
- Existing: Resend API integration (`lib/registration-success-email.ts`)
- Existing: `public.settings` table
- Existing: `public.events` table
- Existing: `public.registrations` table with `status` enum including `created` and `confirmed`
- Existing: Email templates in `lib/email-templates.ts` (merged from separate config files)

---

## User Stories

### US-001: Reservation Confirmation Email (Admin-Controlled)
**As a** registered user  
**I want** to receive an email confirmation when I submit my registration  
**So that** I know my registration was received and is awaiting payment review

**Acceptance Criteria (EARS)**:
- **Event**: When a user completes registration form and submits successfully
- **Action**: System creates registration with status `created`
- **Response**: System checks `settings.email.reservation_confirmation_enabled`
  - If enabled: Send reservation confirmation email in user's locale (zh/en)
  - If disabled: Skip email (no notification)
- **State**: Registration record created; email_audit entry logged if sent

**GIVEN** reservation confirmation emails are enabled in admin settings  
**WHEN** user submits registration form with valid data  
**THEN** user receives reservation confirmation email within 30 seconds  
**AND** email contains: user name, event title, "awaiting payment review" message, payment amount/currency, bank account last 5 digits field, contact email address  
**AND** email_audit table logs the sent email with timestamp and status

**GIVEN** reservation confirmation emails are disabled in admin settings  
**WHEN** user submits registration form with valid data  
**THEN** no reservation confirmation email is sent  
**AND** registration is created successfully

---

### US-002: Payment Confirmation Email (Always On)
**As a** registered user  
**I want** to receive an email when admin confirms my payment  
**So that** I know my reservation is confirmed and I can attend the event

**Acceptance Criteria (EARS)**:
- **Event**: When admin clicks "Confirm Payment" in payment review modal
- **Action**: System updates registration status from `created` to `confirmed`
- **Response**: System sends payment confirmation email in user's locale (zh/en)
- **State**: Registration status is `confirmed`; email_audit entry logged

**GIVEN** registration with status `created` and admin views payment review modal  
**WHEN** admin clicks "Confirm Payment"  
**THEN** registration status changes to `confirmed`  
**AND** user receives payment confirmation email within 30 seconds  
**AND** email contains: user name, event title, event date/time/location (venue name + address), contact email address  
**AND** email_audit table logs the sent email with timestamp and status  
**AND** audit_trail records admin action with timestamp

---

### US-003: Admin Email Settings Toggle
**As an** admin  
**I want** to enable or disable reservation confirmation emails  
**So that** I can control when users receive automatic notifications

**Acceptance Criteria (EARS)**:
- **Event**: When admin visits `/admin/emails` page
- **Action**: Admin sees current toggle state (on/off)
- **Response**: Admin can click toggle to change state
- **State**: Setting persisted to `public.settings` table with key `email.reservation_confirmation_enabled`

**GIVEN** admin visits `/admin/emails` page  
**WHEN** page loads  
**THEN** toggle reflects current state from `settings.email.reservation_confirmation_enabled`  
**AND** toggle is accessible via keyboard (Space/Enter to toggle)

**GIVEN** admin changes toggle from off to on  
**WHEN** toggle state updates  
**THEN** setting is saved to database immediately  
**AND** success notification appears  
**AND** subsequent registrations will receive reservation confirmation emails

---

### US-004: Payment Review Workflow
**As an** admin  
**I want** to review and confirm payment details for registrations  
**So that** I can verify payment before confirming reservations

**Acceptance Criteria (EARS)**:
- **Event**: When admin views registrations list with status `created`
- **Action**: Admin sees "Review Payment" button in status column
- **Response**: Clicking opens modal showing user info, event details, payment amount/currency, bank account last 5 digits
- **State**: Modal provides "Confirm Payment" and "Reject Payment" actions

**GIVEN** registration exists with status `created`  
**WHEN** admin views registration in admin portal  
**THEN** "Review Payment" button appears in status column  
**AND** button is keyboard accessible

**GIVEN** admin clicks "Review Payment" button  
**WHEN** modal opens  
**THEN** modal displays:
  - User name, email, profession, age
  - Event title, date, location
  - Payment amount and currency from event configuration
  - Bank account last 5 digits (if provided)
  - Two buttons: "Confirm Payment" and "Reject Payment"

**GIVEN** admin clicks "Confirm Payment"  
**WHEN** API confirms action  
**THEN** registration status changes to `confirmed`  
**AND** payment confirmation email is sent  
**AND** modal closes  
**AND** registration list refreshes

**GIVEN** admin clicks "Reject Payment"  
**WHEN** admin enters rejection reason  
**THEN** registration status changes to `cancelled`  
**AND** audit_trail records rejection with reason and admin actor  
**AND** modal closes  
**AND** registration list refreshes  
**AND** no email is sent to user

---

### US-005: Send Test Email
**As an** admin  
**I want** to send test emails to verify email configuration  
**So that** I can ensure emails are working before enabling them for users

**Acceptance Criteria (EARS)**:
- **Event**: When admin visits `/admin/emails` page
- **Action**: Admin enters email address and clicks "Send Test Email"
- **Response**: System sends test reservation confirmation email to provided address
- **State**: Email sent; email_audit logs test email

**GIVEN** admin is on `/admin/emails` page  
**WHEN** admin enters valid email address and clicks "Send Test Email"  
**THEN** test email is sent to that address within 30 seconds  
**AND** success notification appears with "Test email sent to {address}"  
**AND** email_audit table logs test email with type 'test'

**GIVEN** admin enters invalid email address  
**WHEN** admin clicks "Send Test Email"  
**THEN** validation error appears  
**AND** no email is sent

---

### US-006: View Email History
**As an** admin  
**I want** to view history of all sent emails  
**So that** I can debug delivery issues and verify email activity

**Acceptance Criteria (EARS)**:
- **Event**: When admin visits `/admin/emails` page
- **Action**: Admin views email history table
- **Response**: Table displays recent emails with: timestamp, recipient, type, status, event
- **State**: Paginated list of email_audit entries

**GIVEN** admin is on `/admin/emails` page  
**WHEN** page loads  
**THEN** email history table displays last 50 emails sorted by timestamp descending  
**AND** each row shows: sent_at, recipient email, email type (reservation/payment/test), status (sent/failed), event title  
**AND** table supports pagination for viewing older emails

---

## Technical Design

### Database Schema Changes

#### Migration 009: Email Notifications Infrastructure

**File**: `lib/db/migrations/009_email_notifications.sql`

```sql
-- Migration 009: Email Notifications Infrastructure
-- 1. Add payment configuration to events table
-- 2. Create email audit table for tracking sent emails
-- 3. Add email reservation confirmation setting

-- Add payment columns to events table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='events' AND column_name='payment_amount') THEN
    ALTER TABLE events ADD COLUMN payment_amount DECIMAL(10,2);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='events' AND column_name='payment_currency') THEN
    ALTER TABLE events ADD COLUMN payment_currency VARCHAR(3) CHECK (payment_currency IN ('TWD', 'EUR', 'USD'));
  END IF;
END $$;

-- Create email_audit table
CREATE TABLE IF NOT EXISTS email_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recipient_email VARCHAR(254) NOT NULL,
  email_type VARCHAR(50) NOT NULL CHECK (email_type IN ('reservation_confirmation', 'payment_confirmation', 'test')),
  status VARCHAR(20) NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  registration_id TEXT REFERENCES registrations(id) ON DELETE SET NULL,
  event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
  locale VARCHAR(5) NOT NULL DEFAULT 'en',
  subject TEXT,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_email_audit_sent_at ON email_audit(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_audit_recipient ON email_audit(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_audit_registration ON email_audit(registration_id);

-- Add reservation confirmation email setting to settings table
INSERT INTO settings (key, value, updated_at)
VALUES ('email.reservation_confirmation_enabled', 'false', NOW())
ON CONFLICT (key) DO NOTHING;

-- Add comments
COMMENT ON TABLE email_audit IS 'Audit trail for all emails sent by the system';
COMMENT ON COLUMN events.payment_amount IS 'Payment amount required for event registration';
COMMENT ON COLUMN events.payment_currency IS 'Currency code for payment amount (TWD, EUR, USD)';
```

### Email Templates

Email templates are now unified in a single file: `lib/email-templates.ts`

#### Merged Template Structure

**File**: `lib/email-templates.ts`

This file contains both registration success and payment confirmation templates with:
- Shared type definitions: `EmailLocale`, `EmailTemplate`
- Two template getters: `getRegistrationSuccessEmailTemplates()` and `getPaymentConfirmationEmailTemplates()`
- Shared interpolation helpers: `interpolateTemplate()` and `interpolateEmailTemplate()`

#### Registration Success Email Template

Variables:
- `{{name}}` - User's name
- `{{eventTitle}}` - Event title
- `{{paymentAmount}}` - Payment amount
- `{{paymentCurrency}}` - Payment currency (TWD/EUR/USD)
- `{{bankLast5}}` - Bank account last 5 digits (replaced `{{paymentInstructions}}`)
- `{{siteUrl}}` - Site URL
- Contact email embedded: `bookdigest2020@gmail.com` (from `EMAIL_CONFIG.REGISTRATION_EMAIL_REPLY_TO`)

```typescript
zh: {
  subject: 'Book Digest 報名成功｜{{eventTitle}}',
  body: `嗨 {{name}}，

感謝您報名參加 Book Digest 活動！

我們已收到您的報名，目前正在審核您的付款資訊。

活動詳情：
• 活動：{{eventTitle}}
• 付款金額：{{paymentAmount}} {{paymentCurrency}}
• 匯款帳號末五碼：{{bankLast5}}

一旦確認付款，我們將發送確認郵件給您。

如有任何問題，請隨時與我們聯繫：bookdigest2020@gmail.com

Book Digest 團隊
{{siteUrl}}`,
},
en: {
  subject: 'Book Digest Registration Received | {{eventTitle}}',
  body: `Hi {{name}},

Thank you for registering for Book Digest event!

We have received your registration and are currently reviewing your payment information.

Event Details:
• Event: {{eventTitle}}
• Payment Amount: {{paymentAmount}} {{paymentCurrency}}
• Bank Account Last 5 Digits: {{bankLast5}}

Once payment is confirmed, we will send you a confirmation email.

If you have any questions, please feel free to contact us at bookdigest2020@gmail.com

Book Digest Team
{{siteUrl}}`,
}
```

#### Payment Confirmation Email Template

Variables:
- `{{name}}` - User's name
- `{{eventTitle}}` - Event title
- `{{eventDate}}` - Formatted event date in local time
- `{{eventLocation}}` - Venue name and address (e.g., "Venue Name, 123 Street Address")
- `{{siteUrl}}` - Site URL
- Contact email embedded: `bookdigest2020@gmail.com` (from `EMAIL_CONFIG.REGISTRATION_EMAIL_REPLY_TO`)

```typescript
zh: {
  subject: 'Book Digest 付款確認｜{{eventTitle}}',
  body: `嗨 {{name}}，

感謝您的付款！您的報名已確認。

活動詳情：
• 活動：{{eventTitle}}
• 日期：{{eventDate}}
• 地點：{{eventLocation}}

我們期待在活動中見到您！

如有任何問題，請隨時與我們聯繫：bookdigest2020@gmail.com

Book Digest 團隊
{{siteUrl}}`,
},
en: {
  subject: 'Book Digest Payment Confirmed | {{eventTitle}}',
  body: `Hi {{name}},

Thank you for your payment! Your registration is now confirmed.

Event Details:
• Event: {{eventTitle}}
• Date: {{eventDate}}
• Location: {{eventLocation}}

We look forward to seeing you at the event!

If you have any questions, please feel free to contact us at bookdigest2020@gmail.com

Book Digest Team
{{siteUrl}}`,
}
```

### API Endpoints

#### GET /api/admin/settings/email

**Purpose**: Retrieve email settings

**Auth**: Required (Bearer token)

**Response**:
```typescript
{
  reservationConfirmationEnabled: boolean;
}
```

**Implementation**: Read from `settings` table where `key = 'email.reservation_confirmation_enabled'`

---

#### PUT /api/admin/settings/email

**Purpose**: Update email settings

**Auth**: Required (Bearer token)

**Body**:
```typescript
{
  reservationConfirmationEnabled: boolean;
}
```

**Response**:
```typescript
{
  ok: boolean;
  settings: {
    reservationConfirmationEnabled: boolean;
  };
}
```

**Implementation**: Update `settings` table row with key `email.reservation_confirmation_enabled`

---

#### POST /api/admin/email-test

**Purpose**: Send test email

**Auth**: Required (Bearer token)

**Body**:
```typescript
{
  recipientEmail: string;
  emailType: 'reservation_confirmation' | 'payment_confirmation';
}
```

**Response**:
```typescript
{
  ok: boolean;
  message: string;
}
```

**Implementation**: 
- Validate email format
- Send test email using template
- Log to email_audit with type 'test'
- Return success/failure

---

#### GET /api/admin/email-history

**Purpose**: Retrieve email history

**Auth**: Required (Bearer token)

**Query Params**:
- `limit` (optional, default 50, max 200)
- `offset` (optional, default 0)
- `type` (optional filter: 'reservation_confirmation' | 'payment_confirmation' | 'test')

**Response**:
```typescript
{
  emails: Array<{
    id: string;
    sentAt: string;
    recipientEmail: string;
    emailType: string;
    status: string;
    eventId: number | null;
    eventTitle: string | null;
    locale: string;
    subject: string;
    errorMessage: string | null;
  }>;
  total: number;
}
```

**Implementation**: Query `email_audit` table with joins to events table for event titles

---

#### POST /api/admin/registrations/[id]/confirm-payment

**Purpose**: Confirm payment and send payment confirmation email

**Auth**: Required (Bearer token)

**URL Params**: `id` (registration ID)

**Body**: Empty `{}`

**Response**:
```typescript
{
  ok: boolean;
  registration: RegistrationRecord;
}
```

**Implementation**:
1. Validate registration exists and status is `created`
2. Update registration status to `confirmed`
3. Add audit trail entry with event `admin_updated`, summary "Payment confirmed by admin"
4. Fetch event details including payment info
5. Send payment confirmation email
6. Log to email_audit
7. Return updated registration

---

#### POST /api/admin/registrations/[id]/reject-payment

**Purpose**: Reject payment with reason

**Auth**: Required (Bearer token)

**URL Params**: `id` (registration ID)

**Body**:
```typescript
{
  reason: string; // Required, min 5 chars
}
```

**Response**:
```typescript
{
  ok: boolean;
  registration: RegistrationRecord;
}
```

**Implementation**:
1. Validate registration exists and status is `created`
2. Validate reason is provided and >= 5 characters
3. Update registration status to `cancelled`
4. Add audit trail entry with event `admin_updated`, summary "Payment rejected by admin", details { reason }
5. Return updated registration
6. Do NOT send email

---

### Components

#### AdminEmailsPage

**File**: `app/admin/emails/page.tsx` (new)

**Layout**:
Three sections stacked vertically:

1. **Email Settings Section**
   - Heading: "Email Settings"
   - Toggle switch for "Reservation Confirmation Emails"
   - Description text: "When enabled, users receive confirmation email immediately after registration. Payment confirmation emails are always sent when admin confirms payment."
   - Real-time save on toggle change

2. **Test Email Section**
   - Heading: "Send Test Email"
   - Email input field (validated)
   - Email type dropdown: "Reservation Confirmation" | "Payment Confirmation"
   - "Send Test Email" button
   - Success/error notification

3. **Email History Section**
   - Heading: "Email History"
   - Data table with columns: Sent At, Recipient, Type, Status, Event, Subject
   - Pagination (50 per page)
   - Filter by type dropdown
   - "Refresh" button

**Behavior**:
- Fetch settings on mount via GET /api/admin/settings/email
- Toggle change triggers PUT /api/admin/settings/email
- Test email form validates email format before enabling send button
- Test email submission calls POST /api/admin/email-test
- Email history fetches via GET /api/admin/email-history
- Auto-refresh history after sending test email

---

#### PaymentReviewModal

**File**: `components/admin/PaymentReviewModal.tsx` (new)

**Props**:
```typescript
{
  registration: RegistrationRecord;
  event: Event;
  onClose: () => void;
  onConfirm: (id: string) => Promise<void>;
  onReject: (id: string, reason: string) => Promise<void>;
}
```

**Layout**:
- Modal overlay with centered card
- Header: "Review Payment"
- Two-column layout:
  - Left: User information (name, email, profession, age)
  - Right: Event information (title, date, location)
- Payment section: Amount and currency (from event config)
- Bank account section: Last 5 digits (if provided by user)
- Footer with two buttons:
  - "Reject Payment" (secondary, left-aligned) - opens reject reason dialog
  - "Confirm Payment" (primary, right-aligned)

**Behavior**:
- Confirm button calls `onConfirm(registration.id)`, shows loading state
- Reject button shows inline form for reason input (required, min 5 chars)
- Reject reason form has "Cancel" and "Reject" buttons
- After confirm/reject action completes, modal closes automatically
- Escape key and overlay click close modal

---

#### AdminRegistrationRow (Updated)

**File**: `components/admin/AdminRegistrationRow.tsx`

**Changes**:
- When `registration.status === 'created'`, show "Review Payment" button in status column
- Button styled as secondary action button
- Clicking button opens `PaymentReviewModal`
- Pass registration, event, and callback handlers to modal
- After modal actions complete, refresh registration list

---

### Email Sending Logic

#### Update Registration Flow

**File**: `app/api/event/[slug]/register/route.ts`

**Changes**:
After creating registration with status `created`, check if reservation confirmation emails are enabled:

```typescript
// After line 151 (after creating reservation)
const emailSettings = await getEmailSettings();

if (emailSettings.reservationConfirmationEnabled) {
  await sendReservationConfirmationEmail({
    locale,
    name,
    email,
    eventTitle: event.title,
    eventTitleEn: event.titleEn,
    paymentAmount: event.paymentAmount,
    paymentCurrency: event.paymentCurrency,
    registrationId: reservationRecord.id,
    eventId: event.id,
  });
}
```

#### New Email Functions

**File**: `lib/email-service.ts` (new)

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function getEmailSettings(): Promise<{ reservationConfirmationEnabled: boolean }> {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'email.reservation_confirmation_enabled')
    .single();

  if (error || !data) {
    return { reservationConfirmationEnabled: false };
  }

  return {
    reservationConfirmationEnabled: data.value === 'true',
  };
}

export async function updateEmailSettings(settings: { reservationConfirmationEnabled: boolean }): Promise<void> {
  await supabase
    .from('settings')
    .update({
      value: String(settings.reservationConfirmationEnabled),
      updated_at: new Date().toISOString(),
    })
    .eq('key', 'email.reservation_confirmation_enabled');
}

export async function logEmailAudit(entry: {
  recipientEmail: string;
  emailType: 'reservation_confirmation' | 'payment_confirmation' | 'test';
  status: 'sent' | 'failed' | 'skipped';
  registrationId?: string;
  eventId?: number;
  locale: string;
  subject: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await supabase.from('email_audit').insert({
    recipient_email: entry.recipientEmail,
    email_type: entry.emailType,
    status: entry.status,
    registration_id: entry.registrationId,
    event_id: entry.eventId,
    locale: entry.locale,
    subject: entry.subject,
    error_message: entry.errorMessage,
    metadata: entry.metadata,
  });
}

export async function sendReservationConfirmationEmail(input: {
  locale: 'zh' | 'en';
  name: string;
  email: string;
  eventTitle: string;
  eventTitleEn?: string;
  paymentAmount: number | null;
  paymentCurrency: string | null;
  bankLast5?: string; // Bank account last 5 digits
  registrationId: string;
  eventId: number;
}): Promise<void> {
  // Implementation similar to sendRegistrationSuccessEmail
  // Use updated templates with {{bankLast5}} instead of {{paymentInstructions}}
  // Log to email_audit with type 'reservation_confirmation'
}

export async function sendPaymentConfirmationEmail(input: {
  locale: 'zh' | 'en';
  name: string;
  email: string;
  eventTitle: string;
  eventTitleEn?: string;
  eventDate: string;
  eventLocation: string; // For timezone conversion (TW/NL/ONLINE)
  venueName: string; // For display in email
  venueAddress?: string; // For display in email (optional)
  registrationId: string;
  eventId: number;
}): Promise<void> {
  // Format venue display: "Venue Name, Address" or just "Venue Name"
  // Use venueName and venueAddress to interpolate {{eventLocation}} in template
  // Send via Resend API
  // Log to email_audit with type 'payment_confirmation'
}
```

---

## Testing Strategy

### Unit Tests

**File**: `tests/lib/email-service.test.ts` (new)

- Test `getEmailSettings()` returns correct value from settings table
- Test `updateEmailSettings()` persists changes to settings table
- Test `logEmailAudit()` creates record in email_audit table
- Test email template interpolation for both locales

**File**: `tests/api/admin-settings-email.test.ts` (new)

- GET /api/admin/settings/email returns current settings
- PUT /api/admin/settings/email updates settings successfully
- PUT /api/admin/settings/email requires authentication

**File**: `tests/api/admin-email-test.test.ts` (new)

- POST /api/admin/email-test sends test email
- POST /api/admin/email-test validates email format
- POST /api/admin/email-test logs to email_audit

**File**: `tests/api/admin-email-history.test.ts` (new)

- GET /api/admin/email-history returns paginated results
- GET /api/admin/email-history filters by type
- GET /api/admin/email-history includes event titles

**File**: `tests/api/admin-payment-review.test.ts` (new)

- POST /api/admin/registrations/[id]/confirm-payment updates status to confirmed
- POST /api/admin/registrations/[id]/confirm-payment sends payment email
- POST /api/admin/registrations/[id]/confirm-payment logs audit trail
- POST /api/admin/registrations/[id]/reject-payment updates status to cancelled
- POST /api/admin/registrations/[id]/reject-payment requires reason
- POST /api/admin/registrations/[id]/reject-payment logs audit trail with reason

### Integration Tests

**File**: `tests/integration/email-flow.test.ts` (new)

- Full registration flow with reservation email enabled
- Full registration flow with reservation email disabled
- Payment review flow: confirm payment and verify email sent
- Payment review flow: reject payment and verify no email sent

### E2E Tests

**File**: `tests/e2e/admin-emails.spec.ts` (new)

- Admin can toggle reservation confirmation emails
- Admin can send test email
- Admin can view email history
- Email history shows correct sent emails

**File**: `tests/e2e/payment-review.spec.ts` (new)

- Admin can open payment review modal from registrations list
- Admin can confirm payment via modal
- Admin can reject payment with reason via modal
- Registration list updates after payment action

---

## Implementation Plan

**Implementation Order**: US-005 → US-003 → US-006 → US-002/US-004 → US-001

This sequence allows testing email delivery first, then adding toggle control, before enabling any automated email flows.

---

### Phase 1: Database Schema (0.5 day)
- Create migration 009
- Test migration on local Supabase
- Add seed data for payment_amount and payment_currency to existing events
- Verify settings table has email.reservation_confirmation_enabled row

**Files**:
- `lib/db/migrations/009_email_notifications.sql`
- `lib/db/seed-payment-config.sql` (for testing)

---

### Phase 2: Email Templates and Core Email Service (1 day)
- ✅ **COMPLETED**: Created unified email templates in `lib/email-templates.ts` (merged from separate config files)
- ✅ **COMPLETED**: Registration success templates now use `{{bankLast5}}` instead of `{{paymentInstructions}}`
- ✅ **COMPLETED**: Both templates include contact email `bookdigest2020@gmail.com` from `EMAIL_CONFIG.REGISTRATION_EMAIL_REPLY_TO`
- ✅ **COMPLETED**: Payment confirmation templates display venue name + address in `{{eventLocation}}`
- Create `lib/email-service.ts` with core functions
- Implement email audit logging

**Files**:
- ✅ `lib/email-templates.ts` (created, replaces separate config files)
- `lib/email-service.ts` (partial - needs completion)

---

### Phase 3: Test Email API + UI (1 day) - **US-005 FIRST**
- Implement POST /api/admin/email-test
- Create minimal AdminEmailsPage with test email section only
- Write unit tests
- Manual testing to verify email delivery works

**Files**:
- `app/api/admin/email-test/route.ts`
- `app/admin/emails/page.tsx` (test section only)
- `tests/api/admin-email-test.test.ts`

**Milestone**: Admin can send test emails to verify Resend integration works

---

### Phase 4: Email Settings API + UI (1 day) - **US-003 SECOND**
- Implement GET /api/admin/settings/email
- Implement PUT /api/admin/settings/email
- Add email settings toggle section to AdminEmailsPage
- Add authentication middleware
- Write unit tests

**Files**:
- `app/api/admin/settings/email/route.ts`
- `app/admin/emails/page.tsx` (add settings section)
- `tests/api/admin-settings-email.test.ts`

**Milestone**: Admin can control reservation email toggle (but no automated emails yet)

---

### Phase 5: Email History API + UI (1 day) - **US-006**
- Implement GET /api/admin/email-history
- Add email history section to AdminEmailsPage
- Implement pagination and filtering
- Write unit tests

**Files**:
- `app/api/admin/email-history/route.ts`
- `app/admin/emails/page.tsx` (add history section)
- `tests/api/admin-email-history.test.ts`

**Milestone**: Complete admin email management page with all three sections

---

### Phase 6: Payment Review APIs and Confirmation Email (2 days) - **US-002 + US-004**
- Implement POST /api/admin/registrations/[id]/confirm-payment
- Implement POST /api/admin/registrations/[id]/reject-payment
- Implement sendPaymentConfirmationEmail function
- Create PaymentReviewModal component
- Update AdminRegistrationRow with review button
- Write unit and integration tests

**Files**:
- `app/api/admin/registrations/[id]/confirm-payment/route.ts`
- `app/api/admin/registrations/[id]/reject-payment/route.ts`
- `components/admin/PaymentReviewModal.tsx`
- `components/admin/AdminRegistrationRow.tsx` (update)
- `lib/email-service.ts` (update)
- `tests/api/admin-payment-review.test.ts`

**Milestone**: Admin can review payments and payment confirmation emails are sent (always on)

---

### Phase 7: Reservation Confirmation Email Integration (0.5 day) - **US-001**
- Update registration route to send reservation email conditionally
- Implement sendReservationConfirmationEmail function
- Write integration tests

**Files**:
- `app/api/event/[slug]/register/route.ts` (update)
- `lib/email-service.ts` (update)
- `tests/integration/email-flow.test.ts`

**Milestone**: Automated reservation emails work when toggle is enabled

---

### Phase 8: E2E Tests and Documentation (1.5 days)
- Write E2E tests for all email flows
- Update admin documentation with email features
- Update API documentation
- Run full test suite
- Manual testing of all flows

**Files**:
- `tests/e2e/admin-emails.spec.ts`
- `tests/e2e/payment-review.spec.ts`
- `docs/admin-api-v2.md` (update)
- `docs/admin-guide.md` (update)
- `docs/admin-email-guide.md` (new)
- `docs/email-architecture.md` (new)
- `README.md` (update)

---

**Total Estimate**: 8.5 days

---

## Security Considerations

- **Admin Authentication**: All admin endpoints require Bearer token authentication
- **Email Validation**: Strict email format validation before sending
- **Rate Limiting**: Test email endpoint should have rate limiting (max 10 per hour per admin)
- **Audit Trail**: All payment review actions logged with admin actor
- **SQL Injection**: Use parameterized queries for all database operations
- **XSS Prevention**: Sanitize all user input displayed in admin UI
- **CSRF Protection**: Use Next.js built-in CSRF protection for admin forms

---

## Performance Considerations

- **Email Sending**: Async, should not block registration API response (current behavior preserved)
- **Email History Pagination**: Default 50, max 200 per page to prevent large query load
- **Database Indexes**: Add indexes on email_audit(sent_at), email_audit(recipient_email), email_audit(registration_id)
- **Settings Caching**: Consider caching email settings for 5 minutes to reduce database reads

---

## Monitoring and Observability

- **Metrics to Track**:
  - Email send success rate (overall and by type)
  - Email send latency
  - Email bounce rate (if Resend provides webhook)
  - Payment review actions per day
  - Failed email attempts

- **Alerts**:
  - Email send failure rate > 5%
  - Resend API errors
  - Email audit table growth rate (detect spam or misconfiguration)

- **Logs**:
  - All email sends logged to email_audit
  - Payment review actions logged to registration audit_trail
  - Admin actions logged with timestamp and actor

---

## Rollout Plan

### Stage 1: Dark Launch (Preview Environment)
- Deploy migration to preview Supabase
- Deploy code to preview environment
- Test all flows manually
- Verify email delivery with test accounts
- Keep reservation confirmation emails disabled

### Stage 2: Limited Production (Reservation Emails Off)
- Deploy migration to production Supabase
- Deploy code to production
- Verify payment review workflow works
- Admin team uses payment confirmation emails
- Monitor email_audit table for issues

### Stage 3: Enable Reservation Emails (Optional)
- Admin team enables reservation confirmation emails via toggle
- Monitor user feedback and email deliverability
- Track open rates and bounce rates

---

## Documentation

### User-Facing Documentation
- None (admin feature only)

### Admin Documentation

**File**: `docs/admin-email-guide.md` (new)

- How to enable/disable reservation confirmation emails
- How to review and confirm payments
- How to reject payments with reasons
- How to send test emails
- How to view email history
- Troubleshooting email delivery issues

### Technical Documentation

**File**: `docs/email-architecture.md` (new)

- Email system architecture diagram
- Email template interpolation variables
- Email audit table schema
- Resend API integration details
- Email sending flow diagrams

### API Documentation

**File**: `docs/admin-api-v2.md` (update)

- Add sections for six new endpoints
- Include request/response examples
- Document authentication requirements

---

## Recent Changes (2026-04-19)

### Template Structure Refactoring
- **Merged config files**: Combined `lib/registration-success-email-config.ts` and `lib/payment-confirmation-email-config.ts` into single `lib/email-templates.ts`
- **Template getters renamed**: Functions now named `getRegistrationSuccessEmailTemplates()` and `getPaymentConfirmationEmailTemplates()` to reflect they return templates, not settings
- **Database-driven settings**: Registration email enabled state now read from `settings` table via `getEmailSettings()` instead of hardcoded config

### Template Content Updates
- **Bank account field**: Replaced `{{paymentInstructions}}` with `{{bankLast5}}` in registration success email templates
- **Contact information**: Added `bookdigest2020@gmail.com` (from `EMAIL_CONFIG.REGISTRATION_EMAIL_REPLY_TO`) to "please feel free to contact us" text in both template types
- **Venue display**: Payment confirmation emails now show human-readable venue name + address instead of location codes (TW/NL/ONLINE)

### SendEventEmailInput Type Updates
The email service input type now includes separate fields for:
- `eventLocation`: Venue location code (TW/NL/ONLINE) for timezone conversion
- `venueName`: Human-readable venue name for display in emails
- `venueAddress`: Optional venue address for display in emails
- `eventTitleEn`: Optional English event title (with fallback to main title)

---

## Open Questions

1. **Payment Instructions Text**: Should payment instructions be configurable per event or global? Currently assuming global configuration.
   - **Resolution Needed**: Design where to store payment instructions (settings table with key 'payment.instructions.zh' and 'payment.instructions.en'?)

2. **Email Send Retry Logic**: Should failed emails be automatically retried? If yes, how many times?
   - **Current Approach**: No automatic retry. Admin can resend manually if needed (future enhancement).

3. **Email Bounce Handling**: Should we handle Resend webhook for bounces/complaints?
   - **Current Approach**: Not in scope for FEATURE-001. Track manually via Resend dashboard.

4. **Admin Notification**: Should admin receive notification when new registration needs review?
   - **Current Approach**: Not in scope. Admin checks dashboard manually.

---

## Future Enhancements (Out of Scope)

- Email template editor in admin UI
- Scheduled reminder emails before event
- Bulk payment confirmation action
- Export email audit logs to CSV
- Resend webhook integration for delivery status
- Push notifications for admin when payment needs review
- Email preview before sending
- A/B testing different email templates

---

## Traceability

- **Spec ID**: FEATURE-001
- **Related Issues**: TBD
- **Related Commits**: Tag with `feat(FEATURE-001):`
- **Related Tests**: All test files tagged with `// Related to FEATURE-001`

---

## Approval

**Pending Review**
