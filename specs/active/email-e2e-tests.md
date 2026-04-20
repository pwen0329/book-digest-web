# Email E2E Test Specification

## Overview

Comprehensive email notification testing covering all email flows in both English (EN) and Chinese (ZH) locales.

## Test Infrastructure

- **SMTP Server**: MailHog (Docker container)
- **Test File**: `tests/e2e/email.spec.ts`
- **Helper Functions**: `tests/e2e/helpers/mailhog.ts`

## Test Cases

### 1. Happy Path: Registration + Payment Confirmation

**EN Locale Test:**
- Admin enables email notifications
- Admin creates event with EN title
- User registers for event (EN form)
- System sends registration confirmation email
- Admin confirms payment via admin portal
- System sends payment confirmation email
- Verifies both emails contain correct content in English

**ZH Locale Test:**
- Same flow as EN but with Chinese content
- User registers via ZH form
- Emails verified to contain Chinese text

### 2. Admin Test Emails

**EN Locale Test:**
- Admin navigates to `/admin/emails`
- Admin sends test payment confirmation email in EN
- Verifies test email delivered with correct locale

**ZH Locale Test:**
- Admin sends test email with ZH locale selected
- Verifies Chinese content in test email

### 3. Cancellation Emails

**EN Locale Test:**
- Creates event and registration
- Admin cancels registration with custom email
- Verifies cancellation email sent with admin's custom message in English

**ZH Locale Test:**
- Same flow with Chinese cancellation message
- Verifies Chinese content in cancellation email

### 4. Negative Test

**Email Disabled Test:**
- Admin disables email notifications
- User registers for event
- Verifies NO email sent (registration still succeeds but no confirmation sent)

## Running Tests

```bash
# Start MailHog
docker-compose up -d mailhog

# Run email tests
npx playwright test tests/e2e/email.spec.ts

# Run specific test
npx playwright test tests/e2e/email.spec.ts -g "EN locale"

# Run on specific browser
npx playwright test tests/e2e/email.spec.ts --project=chromium

# View captured emails in browser
open http://localhost:8025

# Stop MailHog
docker-compose down
```

## Environment Requirements

```env
# Admin auth
ADMIN_PASSWORD=test-admin

# Supabase (local instance)
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=xxx

# SMTP for MailHog
SMTP_HOST=localhost
SMTP_PORT=1025
GMAIL_USER=test@example.com
GMAIL_PASSWORD=test-password

# Email configuration
REGISTRATION_EMAIL_FROM=test@bookdigest.com
REGISTRATION_EMAIL_REPLY_TO=reply@bookdigest.com

# MailHog API endpoint
MAILHOG_API_URL=http://localhost:8025/api/v2
```

**Note:** Get your local Supabase credentials with `npx supabase status`. The Project URL and service role Secret key are shown in the output.

## Coverage Summary

| Flow | EN Locale | ZH Locale | Notes |
|------|-----------|-----------|-------|
| Registration Confirmation | ✅ | ✅ | Sent after successful registration |
| Payment Confirmation | ✅ | ✅ | Sent after admin confirms payment |
| Admin Test Email | ✅ | ✅ | Manual test send from admin panel |
| Cancellation Email | ✅ | ✅ | Custom message from admin |
| Disabled Notifications | ✅ | N/A | Verifies emails not sent when disabled |

## Email Verification

Each test verifies:
- Email delivered to correct recipient
- Subject contains expected keywords
- Body contains user name
- Body contains event title (localized)
- Email type matches expected template

## Integration Points

- **Email Service**: `/lib/email-service.ts`
  - `sendRegistrationSuccessEmail()`
  - `sendPaymentConfirmationEmail()`
  - `sendEmail()` (generic, used for cancellation)
- **Email Templates**: `/lib/email-templates.ts`
  - Registration confirmation templates (EN/ZH)
  - Payment confirmation templates (EN/ZH)
- **Admin APIs**:
  - `POST /api/admin/send-email` - Test email endpoint
  - `POST /api/admin/registrations/[id]/cancel` - Cancellation with email
  - `POST /api/admin/registrations/[id]/confirm-payment` - Payment confirmation
- **Registration API**:
  - `POST /api/event/[slug]/register` - Sends confirmation email

## Related Documentation

- [Email Testing Guide](../docs/email-testing.md) - Detailed MailHog setup and usage
- [README Email Testing Section](../README.md#email-testing) - Quick start guide
- [Admin Data Flow](../docs/admin-data-flow.md) - Admin workflow documentation
