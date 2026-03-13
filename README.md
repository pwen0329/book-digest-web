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

If local dev fails because `.next/` contains old files with the wrong owner or permissions, start with a fresh output directory:

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
- `TALLY_ENDPOINT_TW|NL|EN|DETOX`: optional upstream submission webhooks
- `SUBMIT_SAVE_TO_NOTION=1`: additionally persist submissions to Notion
- `NOTION_TOKEN`, `NOTION_DB_ID`: Notion persistence credentials
- `RESEND_API_KEY`: enables real registration success emails
- `REGISTRATION_EMAIL_FROM`: sender address used by Resend, for example `Book Digest <hello@example.com>`
- `REGISTRATION_EMAIL_REPLY_TO`: optional reply-to address for success emails
- `EMAIL_OUTBOX_FILE`: optional local JSON outbox path for development or automated tests
- `NEXT_PUBLIC_TURNSTILE_SITEKEY`, `TURNSTILE_SECRET_KEY`: Cloudflare Turnstile

If neither `RESEND_API_KEY` nor `EMAIL_OUTBOX_FILE` is configured, submissions still succeed, but confirmation emails are skipped even if the admin toggle is enabled.

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

## Project Map

- `app/[locale]`: public localized routes
- `app/admin`: admin login and dashboard shell
- `app/api/submit`: submission and capacity API
- `app/api/admin/*`: authenticated admin write APIs
- `components/admin/AdminDashboard.tsx`: main admin UI
- `data/books.json`: editable books content
- `data/events-content.json`: editable event content and posters
- `data/signup-capacity.json`: editable capacity windows
- `data/registration-success-email.json`: editable confirmation email settings
- `lib/`: server and shared helpers
- `tests/components`: Vitest regression and functional tests
- `tests/e2e`: Playwright end-to-end coverage

## How submissions work

1. Public signup pages post to `/api/submit?loc=...`.
2. The API validates payloads, Turnstile, and capacity.
3. It optionally forwards to Tally and/or saves to Notion.
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
- `Events`: edit event titles, descriptions, posters, and coming-soon state
- `Capacity`: control registration windows and max capacity
- `Emails`: turn confirmation emails on or off and edit localized subject/body templates

For the `Emails` tab:

- enable the toggle to send confirmation emails after successful registration
- edit the localized subject and body templates
- configure either `RESEND_API_KEY` + `REGISTRATION_EMAIL_FROM` for real delivery, or `EMAIL_OUTBOX_FILE` for local/test delivery
- save the email settings before testing a new signup

Supported email template tokens:

- `{{name}}`
- `{{email}}`
- `{{location}}`
- `{{eventTitle}}`
- `{{siteUrl}}`

## Development notes

- The admin dashboard writes directly to JSON files in `data/`.
- `next build` can fail if the workspace `.next/` directory is root-owned. In that case, validate with a fresh directory:

```bash
export NEXT_DIST_DIR=.next-local-build && npm run build
```

- Playwright local runs start the app with admin auth and capacity-reset helpers enabled.

## Verification checklist

Before pushing:

```bash
npm run test:components
export NEXT_DIST_DIR=.next-local-build && npm run build
npx playwright test --workers=1
```