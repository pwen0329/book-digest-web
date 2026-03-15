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
2. Copy the project URL.
3. Set a strong Supabase database password during project creation and keep it only in your password manager. The app does not need the raw database password unless you later connect with psql or migration tools.
4. Copy the service-role key from Project Settings -> API.
5. Never expose the service-role key to the browser.

## Initialize Database And Storage

1. Open the SQL Editor in Supabase.
2. Run [docs/supabase-admin.sql](/data/yy/book-digest-web/docs/supabase-admin.sql).
3. Confirm these objects exist:
   - `public.admin_documents`
   - `public.registrations`
   - storage bucket `admin-assets`
4. Confirm RLS is enabled on `public.admin_documents` and `public.registrations`.
5. Confirm the public read policy exists for `storage.objects` on bucket `admin-assets`.

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
5. `SUPABASE_ADMIN_DOCUMENTS_TABLE=admin_documents`
6. `SUPABASE_REGISTRATIONS_TABLE=registrations`
7. `SUPABASE_STORAGE_BUCKET=admin-assets`
8. Optional: `RESEND_API_KEY`
9. Optional: `REGISTRATION_EMAIL_FROM`
10. Optional: `REGISTRATION_EMAIL_REPLY_TO`
11. Optional: `NOTION_TOKEN`
12. Optional: `NOTION_DB_ID`
13. Optional: `SUBMIT_SAVE_TO_NOTION=1`
14. Optional: `TALLY_ENDPOINT_TW`, `TALLY_ENDPOINT_NL`, `TALLY_ENDPOINT_EN`, `TALLY_ENDPOINT_DETOX`
15. Recommended for Supabase-first setup: leave `NEXT_PUBLIC_FORMS_ENDPOINT_*` empty so public forms keep posting to the built-in `/api/submit` route.

## Secrets And Where To Store Them

1. Store `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `NOTION_TOKEN`, and `TURNSTILE_SECRET_KEY` only in Vercel project environment variables or another server-side secret manager.
2. Store the Supabase project password only in your password manager. Do not put it in `.env` unless you explicitly add a direct database client later.
3. `NEXT_PUBLIC_*` values are browser-visible by design, so never put passwords or service-role keys in them.
4. If you use local development, put secrets in `.env.local`; do not commit `.env.local`.

## Recommended Setup

1. For the simplest production stack, use Supabase plus the built-in `/api/submit` route.
2. In that setup, Supabase becomes the source of truth for admin documents, registrations, and uploaded assets.
3. Notion becomes optional. Only enable it if you want a secondary mirror for manual ops or CRM workflows.
4. Tally also becomes optional. Only enable it if you still need to forward submissions to an external form endpoint or legacy workflow.
5. For the integration logic and decision tree, read [docs/admin-data-flow.md](/data/yy/book-digest-web/docs/admin-data-flow.md).

## Post-Deploy Verification

1. Log into `/admin` on Vercel.
2. Add a draft book and save it.
3. Upload a book cover and confirm the uploaded asset URL ends in `.webp`.
4. Check `/` and `/books` to confirm the new order and cover are live.
5. Update one event poster and confirm the change appears on `/events`.
6. Submit one registration and verify:
   - a row is added to `public.registrations`
   - `/api/submit?loc=...` count increases
   - the capacity card in `/admin` reflects the new count

## Operational Notes

1. Free tier is enough for development, preview, or light testing.
2. Production should usually use Pro to avoid project pausing and to get backups and better retention.
3. The bootstrap SQL already adds indexes for `location`, `status`, `created_at`, and `updated_at` because those matter for capacity and admin inspection.
4. If concurrency becomes high enough that slot contention matters, the next upgrade is moving reservation acceptance into a database-side transactional function.
