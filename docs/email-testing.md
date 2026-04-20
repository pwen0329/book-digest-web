# Email Testing with MailHog

## Overview

We use [MailHog](https://github.com/mailhog/MailHog) for email testing in both local development and CI. MailHog provides a fake SMTP server that captures all outgoing emails and exposes them via HTTP API and web UI.

## Local Development

### 1. Start MailHog

```bash
docker-compose up -d mailhog
```

This starts MailHog with:
- SMTP server on `localhost:1025`
- Web UI on `http://localhost:8025`
- HTTP API on `http://localhost:8025/api/v2`

### 2. Configure Environment

Ensure `.env.test` includes both MailHog and local Supabase configuration:

```env
# Admin auth
ADMIN_PASSWORD=test-admin

# Supabase (local instance)
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=xxx

# SMTP for MailHog (Docker)
SMTP_HOST=localhost
SMTP_PORT=1025
GMAIL_USER=test@example.com
GMAIL_PASSWORD=test-password

# Email configuration
REGISTRATION_EMAIL_FROM=test@bookdigest.com
REGISTRATION_EMAIL_REPLY_TO=reply@bookdigest.com

# MailHog API endpoint for email verification
MAILHOG_API_URL=http://localhost:8025/api/v2
```

**Getting Supabase credentials from local instance:**

If you have Supabase running locally, get the credentials with:

```bash
npx supabase status
```

Look for:
- **Project URL**: Use this for `SUPABASE_URL`
- **Secret** (under Authentication Keys): Use this for `SUPABASE_SERVICE_ROLE_KEY`

The default local Supabase URL is `http://127.0.0.1:54321` and the service role key is shown in the status output.

### 3. Run Tests

```bash
npm run test:e2e
```

### 4. View Emails

Open http://localhost:8025 in your browser to see all captured emails.

### 5. Stop MailHog

```bash
docker-compose down
```

## GitHub Actions CI

MailHog runs as a service container in `.github/workflows/ci.yml`:

```yaml
services:
  mailhog:
    image: mailhog/mailhog
    ports:
      - 1025:1025
      - 8025:8025
```

Environment variables are set in the workflow file.

## Using in Tests

### Import the helper

```typescript
import { waitForEmail, findEmailByRecipient, clearMailHogMessages } from './helpers/mailhog';
```

### Clear emails before each test

```typescript
test.beforeEach(async () => {
  await clearMailHogMessages();
});
```

### Wait for an email

```typescript
const email = await waitForEmail('user@example.com', {
  timeout: 10000, // 10 seconds
  interval: 500,  // check every 500ms
});

expect(email.Content.Headers.Subject[0]).toContain('Registration Confirmed');
expect(email.Content.Body).toContain('Thank you for registering');
```

### Find email by recipient

```typescript
const email = await findEmailByRecipient('user@example.com');
if (email) {
  console.log('Subject:', email.Content.Headers.Subject[0]);
  console.log('Body:', email.Content.Body);
}
```

### Running Email E2E Tests

The email e2e tests require MailHog to be running. Run them with:

```bash
# Start MailHog
docker-compose up -d mailhog

# Run only email tests
npx playwright test tests/e2e/email.spec.ts

# Run email tests on specific browser
npx playwright test tests/e2e/email.spec.ts --project=chromium

# Stop MailHog when done
docker-compose down
```

**Note:** Email tests are comprehensive and create events, registrations, and test all email flows (registration confirmation, payment confirmation, admin test emails, cancellation emails) in both English and Chinese locales.

## How It Works

1. **Application**: Uses Gmail SMTP provider with `SMTP_HOST=localhost` and `SMTP_PORT=1025`
2. **MailHog**: Accepts any SMTP connection (no auth validation) and stores emails in memory
3. **Tests**: Fetch emails via HTTP API to verify email content

## Troubleshooting

### MailHog not receiving emails

1. Check MailHog is running: `docker-compose ps`
2. Check environment variables are set correctly
3. Check logs: `docker-compose logs mailhog`

### Tests can't connect to MailHog

1. Ensure MailHog is running before tests start
2. Check port 8025 is not in use: `lsof -i :8025`
3. Try accessing http://localhost:8025 in browser

### Emails not appearing in tests

1. Check email was sent successfully (no errors in application logs)
2. Wait longer - increase timeout in `waitForEmail`
3. Check MailHog web UI to see if email was received
