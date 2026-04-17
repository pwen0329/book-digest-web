# Supabase Deployment Checklist

Use this checklist when deploying Book Digest admin on Vercel with Supabase as the persistent backend.

## Cost

1. Supabase has a Free plan at `$0/month`.
2. The Free plan currently includes `500 MB` database size, `1 GB` file storage, and `5 GB` egress.
3. Free projects are paused after `1 week` of inactivity, so they are fine for development or low-traffic testing, but risky for production admin usage.
4. Supabase Pro currently starts at `$25/month` and includes `8 GB` database size, `100 GB` file storage, daily backups, and longer log retention.
5. For a production admin used regularly from Vercel, Pro is the safer default.

## Create Project

1. Create a new Supabase project.
2. Save these account-level credentials in your password manager:
   - Supabase account email
   - Supabase account password or SSO note
   - project name / region
3. Copy the project URL.
4. Set a strong Supabase database password during project creation and keep it only in your password manager. The app does not need the raw database password unless you later connect with `psql`, Prisma, or migration tools.
5. Copy the service-role key from Project Settings -> API.
6. Never expose the service-role key to the browser.
7. Optional but recommended: also copy the anon key into your password manager or deployment notes, even though this app currently does not need it for runtime writes.

## Initialize Database And Storage

1. Open the SQL Editor in Supabase.
2. Run [docs/supabase-admin.sql](/data/yy/book-digest-web/docs/supabase-admin.sql).
3. Confirm these objects exist:
   - `public.admin_documents`
   - `public.registrations`
   - storage bucket `admin-assets`
4. Confirm RLS is enabled on `public.admin_documents` and `public.registrations`.
5. Confirm the public read policy exists for `storage.objects` on bucket `admin-assets`.
6. Confirm `public.registrations` has these extra columns for the upgraded admin:
   - `request_id`
   - `mirror_state`
   - `audit_trail`
7. If this Supabase project existed before the upgraded registrations flow shipped, rerun [docs/supabase-admin.sql](/data/yy/book-digest-web/docs/supabase-admin.sql) even if the tables already exist. The script contains `alter table ... add column if not exists ...` statements plus `notify pgrst, 'reload schema';`, which are required to backfill older projects and refresh PostgREST schema cache.
8. Confirm these indexes exist on `public.registrations`:
   - `registrations_timestamp_idx`
   - `registrations_external_id_idx`
   - `registrations_request_id_idx`
9. After the first successful page render or first `/admin` login, confirm `public.admin_documents` contains these seeded rows:
   - `key='books'`
   - `key='events'`
   - `key='capacity'`
   - `key='registration-success-email'`
10. Spot-check `public.admin_documents.value` for `books` and `events`:
   - `books` should be a non-empty JSON array of book objects
   - `events` should be a JSON object with `TW`, `NL`, `EN`, and `DETOX`
11. Persisted Supabase payload inventory for this codebase:
   - `public.admin_documents.key = 'books'`: localized book metadata, sort order, notes, tags, links, and cover asset URLs
   - `public.admin_documents.key = 'events'`: TW / NL / EN / DETOX poster paths, localized titles, descriptions, signup paths, and coming-soon content
   - `public.admin_documents.key = 'capacity'`: TW / NL / EN / DETOX signup windows with `enabled`, `forceFull`, `startAt`, `endAt`, and `max`
   - `public.admin_documents.key = 'registration-success-email'`: the `enabled` flag plus localized `subject` and `body` templates
   - `public.registrations`: all signup submissions, reconciliation fields, mirror state, and audit trail entries
   - `storage.objects` in bucket `admin-assets`: uploaded admin-managed book covers and event posters
12. Production data checklist: these are the persisted payloads you should verify one by one.
   - `public.admin_documents.key = 'books'`
   - `public.admin_documents.key = 'events'`
   - `public.admin_documents.key = 'capacity'`
   - `public.admin_documents.key = 'registration-success-email'`
   - `public.registrations` rows for signup reservations and admin reporting
   - storage bucket `admin-assets` only if you uploaded admin-managed book covers or event posters
13. These repo files are seed fallbacks and should not be copied manually into Supabase as standalone files:
   - `data/books.json`
   - `data/events-content.json`
   - `data/signup-capacity.json`
   - `data/registration-success-email.json`
   - `messages/*.json`

## RLS Model

1. This app reads and writes admin documents and registrations from the server using `SUPABASE_SERVICE_ROLE_KEY`.
2. Service-role requests bypass RLS, so the app does not require anon/authenticated write policies for runtime operation.
3. Keep client policies absent for `public.admin_documents` and `public.registrations` unless you intentionally add browser-authenticated admin access later.
4. If you later expose these tables to browser clients, add explicit `authenticated` policies and keep `anon` denied.

## Bucket Policy Model

1. The `admin-assets` bucket is public so public pages can render uploaded covers and posters directly.
2. Public read access is allowed for that bucket.
3. Uploads in the current app happen on the server with the service-role key, so browser upload policies are not required.
4. If you later switch to browser-authenticated uploads, use the commented `insert` and `update` policy examples in [docs/supabase-admin.sql](/data/yy/book-digest-web/docs/supabase-admin.sql).

## Vercel Environment Variables

1. `ADMIN_PASSWORD`
2. `ADMIN_SESSION_SECRET`
3. `SUPABASE_URL`
4. `SUPABASE_SERVICE_ROLE_KEY`
5. `SUPABASE_REGISTRATIONS_TABLE=registrations`
6. `SUPABASE_STORAGE_BUCKET=admin-assets`
7. Optional but recommended for automation: `ADMIN_API_SECRET`
8. Optional: `RESEND_API_KEY`
9. Optional: `REGISTRATION_EMAIL_FROM`
10. Optional: `REGISTRATION_EMAIL_REPLY_TO`
11. Optional: `NEXT_PUBLIC_SENTRY_DSN`
12. Optional: `SENTRY_AUTH_TOKEN`

## Secrets And Where To Store Them

1. Store `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `ADMIN_API_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`, and `SENTRY_AUTH_TOKEN` only in Vercel project environment variables or another server-side secret manager.
2. Store the Supabase project password only in your password manager. Do not put it in `.env` unless you explicitly add a direct database client later.
3. Store the Supabase account login only in your password manager, not inside repo docs or `.env.local`.
4. `NEXT_PUBLIC_*` values are browser-visible by design, so never put passwords, service-role keys, or admin secrets in them.
5. If you use local development, put runtime secrets in `.env.local`; do not commit `.env.local`.
6. Recommended split:
   - password manager: Supabase account login, Supabase DB password
   - Vercel env: runtime keys and tokens used by the app
   - `.env.local`: only local-dev copies of the same runtime keys

## Recommended Setup

1. Supabase is the single source of truth for books, events, venues, registrations, and uploaded assets.
2. The built-in `/api/event/[slug]/register` route handles all event registrations.
3. For the integration logic and decision tree, read [docs/admin-data-flow.md](/data/yy/book-digest-web/docs/admin-data-flow.md).
4. For manual verification after deploy, read [docs/admin-validation-runbook.md](/data/yy/book-digest-web/docs/admin-validation-runbook.md).

## Release Gate

1. The repository now includes [/.github/workflows/ci.yml](/data/yy/book-digest-web/.github/workflows/ci.yml) for PR and main-branch quality checks, plus [/.github/workflows/release-checks.yml](/data/yy/book-digest-web/.github/workflows/release-checks.yml) for full release-grade validation across lint, typecheck, build, component tests, and all Playwright browser profiles.
2. To make GitHub truly block bad releases before Vercel deploys them, enable branch protection on `main` and require these status checks before merge:
   - `Lint and Typecheck`
   - `Build`
   - `Playwright E2E (Chromium)`
   - `Release Quality Gate`
3. In Vercel Project Settings, keep GitHub connected to this repository and enable deployment protection so production deploys wait for the required GitHub checks to finish successfully.
4. The repository can ship the workflows, but branch protection rules and Vercel deployment protection must still be turned on in GitHub and Vercel settings manually.

## Post-Deploy Verification

1. Log into `/admin` on Vercel.
2. Open `Books` and confirm the canonical cover hints match your expected `books_zh` / `books_en` numbering strategy.
3. Add a draft book and save it.
4. Upload a book cover and confirm the uploaded asset URL ends in `.webp`.
5. Open `Assets` in `/admin` and confirm the new upload is visible in storage scans.
6. Check `/` and `/books` to confirm the new order and cover are live.
7. Update one event poster and confirm the change appears on `/events`.
8. Submit one registration and verify:
   - a row is added to `public.registrations`
   - the `Registrations` tab shows the row
   - the row has a `request_id` and `audit_trail` event
   - the capacity count in `/admin` reflects the new registration
9. If `/`, `/books`, or `/events` look wrong only on Vercel, inspect Supabase tables first before suspecting build output:
   - empty `books` table can blank the homepage and books page
   - malformed `events` data can break `/events`
11. Useful SQL spot-checks in the Supabase SQL editor:

```sql
select key, jsonb_typeof(value) as value_type, updated_at
from public.admin_documents
order by key;

select jsonb_array_length(value) as books_count
from public.admin_documents
where key = 'books';

select value->'TW'->'title' as tw_title,
       value->'EN'->'title' as en_title,
       value->'DETOX'->'title' as detox_title
from public.admin_documents
where key = 'events';

select id, location, status, source, request_id, updated_at
from public.registrations
order by updated_at desc
limit 20;
```

12. If Supabase SQL editor says `column "id" does not exist` while inspecting `admin_documents`, the query is using the wrong schema assumption. `public.admin_documents` is key-value storage, so inspect `key`, `value`, and `updated_at`, not `id`.
13. If Vercel logs show `ENOENT` for `/var/task/data/books.json` or `/var/task/data/events-content.json`, the deployed server is still evaluating a runtime filesystem fallback somewhere in the request path. Rebuild after confirming the app uses bundled JSON fallbacks or Supabase-backed loaders instead of unconditional `fs` reads.
14. If Vercel logs mention missing columns such as `registrations.createdAt`, `registrations.updatedAt`, or malformed filters such as `registrations.orstatus`, the bug is in the server-side Supabase registrations query builder, not in missing seed data.
15. If Vercel logs mention `PGRST204` with messages like `Could not find the 'audit_trail' column of 'registrations' in the schema cache`, the live Supabase project has not fully applied the upgraded registrations migration or PostgREST has not reloaded its schema cache yet. Rerun [docs/supabase-admin.sql](/data/yy/book-digest-web/docs/supabase-admin.sql), then verify `request_id`, `mirror_state`, and `audit_trail` exist on `public.registrations`.
16. Fast production debug sequence when `/`, `/books`, `/events`, `/api/submit`, or `/api/registrations` fail only on Vercel:
   - open Vercel function logs for the failing request and note the first server-side stack frame
   - run the SQL block above for `public.admin_documents`
   - run `select created_at, updated_at, status, source, request_id from public.registrations order by updated_at desc limit 20;`
   - confirm `books` is a non-empty JSON array and `events` is a JSON object with `TW`, `NL`, `EN`, and `DETOX`
   - confirm `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_REGISTRATIONS_TABLE` are set on the same Vercel environment as the deployment
   - redeploy after clearing any remaining runtime file reads in server utilities
17. If `/api/admin/books`, `/api/admin/events`, `/api/admin/capacity`, or `/api/admin/email` return `400` only on Vercel while `/admin` still loads, suspect an older `public.admin_documents` schema cache. Rerun [docs/supabase-admin.sql](/data/yy/book-digest-web/docs/supabase-admin.sql) so `updated_at` is backfilled and PostgREST reloads the admin document schema.

## Operational Notes

1. Free tier is enough for development, preview, or light testing.
2. Production should usually use Pro to avoid project pausing and to get backups and better retention.
3. The bootstrap SQL already adds indexes for `location`, `status`, `created_at`, and `updated_at` because those matter for capacity and admin inspection.
4. The upgraded registrations viewer also depends on `timestamp`, `external_id`, `request_id`, and JSON audit columns for filtering and reconciliation.
5. For periodic storage cleanup, you can call `DELETE /api/admin/assets?gracePeriodHours=168` with `Authorization: Bearer $ADMIN_API_SECRET` from a cron job or GitHub Action.
6. If concurrency becomes high enough that slot contention matters, the next upgrade is moving reservation acceptance into a database-side transactional function.
7. If a Vercel deployment works locally with `npm run build && npm run start` but fails only in production, compare the persistent `public.admin_documents` payloads against local `data/books.json` and `data/events-content.json` first, then check whether any server utility still performs unconditional runtime file reads for fallback normalization.
