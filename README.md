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

Current dashboard areas:

- `Books`: edit book metadata and copy
- `Events`: edit event titles, descriptions, posters, and coming-soon state
- `Capacity`: control registration windows and max capacity
- `Emails`: turn confirmation emails on or off and edit localized subject/body templates

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