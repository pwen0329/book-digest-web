# Book Digest Web

Next.js 14 app for the Book Digest site. It serves the public bilingual marketing pages, signup flows, and an authenticated admin dashboard for editing books, events, capacity windows, and registration success emails.

## Quick Start

### Requirements

- Node.js 20+
- npm 10+

### Install

```bash
npm install
```

### Run locally

```bash
npm run dev
```

Local development now defaults to a writable `.next-local-dev` build directory. You only need to set `NEXT_DIST_DIR` manually when you want a different custom output folder.

If local dev still fails because an old `.next/` directory contains files with the wrong owner or permissions, start with a fresh output directory explicitly:

```bash
export NEXT_DIST_DIR=.next-local-dev
npm run dev
```

Open `http://127.0.0.1:3000`.

### Useful commands

```bash
npm run test:components
npm run build
npx playwright test --workers=1
```

## Environment

Copy `.env.example` and fill only what you need.

Core variables:

- `ADMIN_PASSWORD`: admin dashboard password
- `ADMIN_SESSION_SECRET`: admin session signing secret
- `SUPABASE_URL`: persistent admin document and upload backend base URL
- `SUPABASE_SERVICE_ROLE_KEY`: server-side key used for admin document writes and storage uploads
- `SUPABASE_REGISTRATIONS_TABLE`: optional persistent registrations table name, defaults to `registrations`
- `SUPABASE_STORAGE_BUCKET`: optional asset bucket name, defaults to `admin-assets`
- `RESEND_API_KEY`: enables real registration success emails via Resend
- `GMAIL_USER`, `GMAIL_PASSWORD`: Gmail SMTP credentials for sending emails (alternative to Resend)
- `REGISTRATION_EMAIL_FROM`: sender address for emails, for example `Book Digest <hello@example.com>`
- `REGISTRATION_EMAIL_REPLY_TO`: optional reply-to address for success emails
- `NEXT_PUBLIC_TURNSTILE_SITEKEY`, `TURNSTILE_SECRET_KEY`: Cloudflare Turnstile

If no email configuration is provided (neither Resend nor Gmail SMTP), submissions still succeed, but confirmation emails are skipped even if the admin toggle is enabled.

If you use Supabase's free tier for production-like environments, remember that inactive projects can auto-pause. When that happens, Vercel may still deploy successfully while `/`, `/books`, or `/events` fail or render stale fallback content until Supabase resumes.

### Admin auth setup

The `/admin` page is protected by a password-based session.

Minimum required variables:

- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`

Recommended local setup in `.env.local`:

```bash
ADMIN_PASSWORD=change-this-to-a-long-random-password
ADMIN_SESSION_SECRET=replace-this-with-a-different-long-random-secret
```

When setting these in Vercel, paste the raw values only. Do not include surrounding quotes.

After changing either value, restart the Next.js server. Existing `npm run dev` processes do not reload admin env values automatically.

You can generate a strong secret with Node:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

If you do not want to store it in `.env.local`, you can also export it before running the app:

```bash
export ADMIN_PASSWORD='change-this-to-a-long-random-password'
export ADMIN_SESSION_SECRET='replace-this-with-a-different-long-random-secret'
npm run dev
```

How it works:

- `ADMIN_PASSWORD` is the password you type on `/admin`
- `ADMIN_SESSION_SECRET` is used by the server to sign and verify the admin session cookie
- if either value is missing, the admin page stays in the "not configured" state
- `NEXT_DIST_DIR` only changes where Next.js writes its build output; it does not control admin auth and it is not the reason login succeeds or fails
- `npm run dev` and `next start` now both work for localhost admin login because secure cookies are only forced for real HTTPS production requests

## Project Map

- `app/[locale]`: public localized routes
- `app/admin`: admin login and dashboard shell
- `app/api/event/[slug]/register`: event registration API
- `app/api/admin/*`: authenticated admin write APIs
- `components/admin/AdminDashboard.tsx`: main admin UI
- `data/books.json`: editable books content
- `data/events.json`: database-driven events data (managed via admin API)
- `data/venues.json`: event venues configuration
- `data/registration-success-email.json`: editable confirmation email settings
- `lib/`: server and shared helpers
- `tests/components`: Vitest regression and functional tests
- `tests/e2e`: Playwright end-to-end coverage

## How registrations work

1. Public signup pages post to `/api/event/[slug]/register`.
2. The API validates payloads, Turnstile, and event capacity.
3. Registration is stored in Supabase (or fallback JSON store).
4. If the admin confirmation-email toggle is enabled, it renders the localized email template and sends it through Resend or the local outbox transport.

## Admin dashboard

Visit `/admin` and sign in with `ADMIN_PASSWORD`.

Typical admin workflow:

1. Set `ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET`.
2. Start the app with `npm run dev`.
3. Open `/admin`.
4. Enter the password from `ADMIN_PASSWORD`.
5. Update content in the dashboard and save each section.

Current dashboard areas:

- `Books`: edit book metadata and copy
- `Events`: create and edit events with dates, venues, capacity, and localized content
- `Emails`: turn confirmation emails on or off and edit localized subject/body templates
- `Registrations`: filter by event, status, source, and submission time; inspect request-aware audit trail; export CSV
- `Assets`: scan referenced uploads vs stored uploads and prune old orphaned assets safely

Books tab notes:

- use `Add book` to create a draft entry
- set a unique slug before saving if you want a custom public URL
- uploaded covers now show canonical `books_zh` / `books_en` numbering hints so you can keep long-term cover naming consistent

Capacity tab notes:

- the live count shown in the editor is derived from the stored registrations source of truth
- in persistent mode, counts come from the Supabase `registrations` table
- without Supabase, counts fall back to the local registrations file used for development and tests
- pending reservations are treated as active for a short TTL so in-flight submissions still reserve capacity

For the `Emails` tab:

- enable the toggle to send confirmation emails after successful registration
- edit the localized subject and body templates
- configure email delivery:
  - Production: `RESEND_API_KEY` + `REGISTRATION_EMAIL_FROM` (via Resend)
  - Alternative: `GMAIL_USER` + `GMAIL_PASSWORD` + `REGISTRATION_EMAIL_FROM` (via Gmail SMTP)
  - Testing: See [Email Testing](#email-testing) section for MailHog setup
- save the email settings before testing a new signup

### File-backed vs persistent admin

File-backed admin means the dashboard reads and writes repository files such as `data/books.json` and `data/events-content.json`.

Persistent admin hosting means the dashboard reads and writes durable runtime storage, so edits survive across deploys and across server instances.

Functional differences:

- file-backed works well on local development and writable self-hosted Node servers
- file-backed is a poor fit for Vercel runtime editing, because runtime file writes are not durable application storage
- persistent admin works on Vercel, because both `/admin` and the public site read the same remote source of truth
- with persistent admin, uploaded poster and cover assets also need persistent object storage instead of local disk

This project now supports a Supabase-backed persistent admin path:

- admin documents are stored in a Supabase table
- admin uploads are stored in a Supabase Storage bucket
- if Supabase env vars are missing, the app falls back to the existing local JSON/file behavior

Recommended production setup:

- Vercel for the public site and `/admin`
- Supabase for persistent admin documents and uploaded assets
- Supabase `registrations` for derived capacity counts and audit history

Supabase bootstrap:

1. Create a table and bucket using [docs/supabase-admin.sql](/data/yy/book-digest-web/docs/supabase-admin.sql).
2. Follow [docs/supabase-deployment-checklist.md](/data/yy/book-digest-web/docs/supabase-deployment-checklist.md).
3. Add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_REGISTRATIONS_TABLE`, and `SUPABASE_STORAGE_BUCKET` in Vercel.
4. Redeploy.

Once Supabase is configured, `/admin` edits persist on Vercel and public pages read the same persistent data source.

Supabase cost summary:

- Free tier is available at `$0/month`, but free projects pause after inactivity and have smaller database/storage quotas.
- Pro starts at `$25/month` and is the safer default for a real production admin workflow on Vercel.

Supported email template tokens:

- `{{name}}`
- `{{email}}`
- `{{location}}`
- `{{eventTitle}}`
- `{{siteUrl}}`

Operational docs:

- [docs/admin-data-flow.md](/data/yy/book-digest-web/docs/admin-data-flow.md)
- [docs/admin-validation-runbook.md](/data/yy/book-digest-web/docs/admin-validation-runbook.md)
- [docs/supabase-deployment-checklist.md](/data/yy/book-digest-web/docs/supabase-deployment-checklist.md)

## Development notes

- Without Supabase env vars, the admin dashboard writes to local JSON files in `data/`.
- With Supabase env vars configured, `/admin` reads and writes persistent remote documents and uploads assets to Supabase Storage.
- `next build` can fail if the workspace `.next/` directory is root-owned. In that case, validate with a fresh directory:

```bash
export NEXT_DIST_DIR=.next-local-build && npm run build
```

- Playwright local runs start the app with admin auth and capacity-reset helpers enabled.

### Local Supabase Setup

For local development with Supabase Docker:

```bash
# Start Supabase stack (includes PostgreSQL + Storage)
docker-compose up -d

# Get connection details
npx supabase status

# Initialize database schema
psql -h localhost -p 54322 -U postgres -d postgres -f lib/db/init.sql

# Storage bucket is created automatically via init.sql
# Verify at: http://localhost:54323 (Supabase Studio)
```

The storage bucket `admin-assets` for book covers and event posters is created automatically by `init.sql` on local Docker. For production Supabase, see [docs/supabase-deployment-checklist.md](docs/supabase-deployment-checklist.md) for manual bucket creation steps.

## Verification checklist

Before pushing:

```bash
npm run test:components
export NEXT_DIST_DIR=.next-local-build && npm run build
npx playwright test --workers=1
```

## Email Testing

For local development and e2e tests, we use [MailHog](https://github.com/mailhog/MailHog) - a fake SMTP server that captures emails and exposes them via HTTP API.

### Quick Start

```bash
# Start MailHog
docker-compose up -d mailhog

# Ensure .env.test is configured (see below)

# Run email e2e tests
npx playwright test tests/e2e/email.spec.ts

# View captured emails
open http://localhost:8025
```

### Environment Setup

Email tests require both MailHog and local Supabase configuration in `.env.test`:

```env
# Get these from: npx supabase status
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

# MailHog SMTP
SMTP_HOST=localhost
SMTP_PORT=1025

# Other email settings (defaults)
REGISTRATION_EMAIL_FROM=test@bookdigest.com
MAILHOG_API_URL=http://localhost:8025/api/v2
```

MailHog runs on:
- SMTP server: `localhost:1025`
- Web UI + API: `http://localhost:8025`

### Email Test Coverage

The email e2e test suite (`tests/e2e/email.spec.ts`) comprehensively tests:
1. **Registration + Payment Confirmation Flow** (both EN/ZH locales)
   - Creates event, registers user, verifies registration confirmation email
   - Admin confirms payment, verifies payment confirmation email
2. **Admin Test Emails** (both EN/ZH locales)
   - Sends test emails from admin panel with different email types and locales
3. **Cancellation Emails** (both EN/ZH locales)
   - Admin cancels registration with custom email notification
4. **Negative Tests**
   - Verifies no emails sent when notifications disabled

See [docs/email-testing.md](docs/email-testing.md) for detailed usage and testing examples.