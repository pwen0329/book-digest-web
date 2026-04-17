# Book Digest — Implementation Plan (Trackable Tasks)

Version: 0.1 (2025-09-02)
Owner: Engineering
References: docs/requirements.md, docs/design.md

Status legend: Todo | In Progress | Blocked | Review | Done
Estimate legend: XS <0.5d, S ~1d, M ~2–3d, L ~4–5d, XL >1wk

Milestones
- M1 Fast UI Validation: Home, Books, Events (counters + external forms), About, i18n basics, analytics.
- M2 Quality & A11y: i18n full, Lighthouse targets, tests, content polish.
- M3 Production Completeness: CMS/DB + API submissions, email, Sentry, Cloudinary.

---

## Epic E0 — Project Setup & Tooling

T-001 Next.js scaffolding [Done | S]
- Description: Create Next.js (App Router) + TS + Tailwind project; configure base ESLint/Prettier; set Node version.
- Outcome: Repo builds locally; `/` renders layout; Tailwind works.
- Deliverables: `package.json`, `tailwind.config.ts`, `app/layout.tsx`, base styles.
- Dependencies: none.

T-002 Vercel project & environments [Todo | XS]
- Description: Connect repo to Vercel; enable PR previews; add `.env.example`.
- Outcome: On push, preview URL is generated.
- Deliverables: Vercel config, `.env.example` with `FORMS_ENDPOINT_TW/NL`.
- Dependencies: T-001.

T-003 Base theming & assets [Done | S]
- Description: Import `logo.svg`, establish color tokens (brand blue/pink/yellow), font loading.
- Outcome: Shared theme via Tailwind; accessible contrast tokens.
- Deliverables: Tailwind theme tokens; font preloads; `public/` assets.
- Dependencies: T-001.

---

## Epic E1 — i18n

T-010 next-intl setup [Done | S]
- Description: Configure `next-intl` with `messages/en.json` & `messages/zh.json`.
- Outcome: Strings render per locale.
- Dependencies: T-001.

T-011 Language toggle with persistence [Done | S]
- Description: Header toggle; remember selection via cookie; preserve route and modal state.
- Outcome: Switching language keeps current page and open modal.
- EARS: L01.
- Dependencies: T-010, T-020, T-050.

---

## Epic E2 — Global Nav & Footer

T-020 Header/Nav & Footer [Done | S]
- Description: Build header with Books/Events/About links and lang toggle; footer with Podcast/Instagram/Email/Contact.
- Outcome: Keyboard accessible nav; external links `_blank` `rel=noopener noreferrer`.
- EARS: N01.
- Dependencies: T-003, T-010.

---

## Epic E3 — Home

T-030 Hero & CTAs [Done | S]
- Description: Implement hero copy + scrapbook image; CTAs to Events & Detox.
- Outcome: Responsive hero; mobile CTAs 44x44.
- EARS: H01.
- Dependencies: T-003, T-020.

---

## Epic E4 — Books Grid

T-040 Data schema & sample data [Done | XS]
- Description: Create `/data/books.json` with 8–12 items following design.
- Outcome: Valid sample data for grid and modal.
- Dependencies: T-001.

T-041 Grid with skeletons & responsive columns [In Progress | M]
- Description: Render grid with 1–5 columns responsive; skeleton while loading.
- Outcome: CLS ≤ 0.1; alt text present.
- EARS: B01.
- Dependencies: T-040.

T-042 Placeholder image fallback [Done | XS]
- Description: Branded placeholder when `coverUrl` missing.
- Outcome: Consistent card layout.
- EARS: B01.
- Dependencies: T-041.

---

## Epic E5 — Book Modal & Deep Links

T-050 Accessible modal component [Done | S]
- Description: Focus trap; Esc/overlay close; announce via aria.
- Outcome: a11y-compliant modal.
- EARS: B02.
- Dependencies: T-041.

T-051 Deep link routing `/books/[slug]` [Done | M]
- Description: Open modal on load by slug; back closes modal to grid; supports reduced motion.
- Outcome: Shareable URLs; good history behavior.
- EARS: B02, L01.
- Dependencies: T-050.

---

## Epic E6 — Events Counters

T-060 Counter component with reduced-motion [Done | S]
- Description: Animated numbers 0 → N in 0.8–1.8s; disable on reduced motion.
- Outcome: Smooth animation; no jank.
- EARS: E01.
- Dependencies: T-001.

T-061 Viewport trigger (once-per-view) [Done | XS]
- Description: IntersectionObserver ≥ 50% visibility, trigger once per session.
- Outcome: Counters don’t retrigger on minor scroll.
- EARS: E01.
- Dependencies: T-060.

T-062 Stats data [Done | XS]
- Description: `/data/stats.json` with targets; load and render.
- Outcome: Configurable targets.
- Dependencies: T-060.

---

## Epic E7 — Event Signup Forms

T-070 TW/NL forms UI & validation (Zod) [Done | M]
- Description: Implement fields, consent, conditional `referralOther`, age/email rules; honeypot input.
- Outcome: Block invalid submit; announce errors via aria-live.
- EARS: F01.
- Dependencies: T-001, T-020.

T-072 Optional: Custom API route (Phase 2) [Todo | M]
- Description: `POST /api/registrations` + Supabase; email via Resend; rate limit; spam checks.
- Outcome: Persisted submissions; confirmation email.
- EARS: F01, P01.
- Dependencies: M3 start; infra available.

---

## Epic E8 — About / Why Us

T-080 About page [Done | S]
- Description: Render story and Why Us; semantic headings.
- Outcome: Accessible content structure.
- EARS: A01.
- Dependencies: T-003.

---

## Epic E9 — SEO & Analytics

T-090 Route metadata & OG tags [Done | XS]
- Description: Titles/descriptions per route; Open Graph images; sitemap; robots.txt; web manifest.
- Outcome: Good link previews; crawlable; SEO optimized.
- EARS: Non-Functional SEO.
- Dependencies: T-001.

T-091 Analytics integration (Plausible/Umami) [Todo | XS]
- Description: Pageview on route change; conversion for form success; no PII.
- Outcome: Basic telemetry.
- EARS: P01.
- Dependencies: T-001, T-071.

---

## Epic E10 — Accessibility & Quality

T-100 A11y audit & fixes [Todo | S]
- Description: Run axe/jest-axe; fix color contrast, landmarks, labels.
- Outcome: WCAG 2.1 AA pass on key pages.
- EARS: multiple.
- Dependencies: core pages ready.

T-101 Keyboard testing [Todo | XS]
- Description: Full flows via keyboard only.
- Outcome: No traps; visible focus.
- Dependencies: T-050, T-070.

---

## Epic E11 — Performance

T-110 Optimize images & fonts [Todo | S]
- Description: `next/image`, lazy-load offscreen, font preloads, compress SVG/logo.
- Outcome: LCP ≤ 2.5s; CLS ≤ 0.1.
- Dependencies: assets in place.

---

## Epic E12 — Testing

T-120 Unit tests (Vitest + RTL) [Todo | M]
- Description: BookCard, BookModal, Counter, SignupForm.
- Outcome: Green tests for happy paths + 1–2 edge cases。
- Dependencies: Components implemented.

T-121 a11y tests (jest-axe) [Todo | XS]
- Description: Home/Books/Events.
- Outcome: No critical violations.
- Dependencies: T-100.

T-122 E2E tests (Playwright) [Todo | M]
- Description: Deep-link book modal, submit TW form, counters fire once.
- Outcome: CI green; smoke catches regressions.
- Dependencies: Core flows ready; CI set.

---

## Epic E13 — CI/CD

T-130 GitHub Actions [Todo | S]
- Description: Lint/typecheck/test on PR; upload Playwright report; block on fail.
- Outcome: Reliable PR gating.
- Dependencies: T-120, T-122.

---

## Epic E14 — Content & Assets

T-140 Migrate UI assets & compress [Todo | XS]
- Description: Move images from `docs/ui`; WebP/AVIF; define aspect ratios.
- Outcome: Optimized public assets.
- Dependencies: T-003.

T-141 Seed content pass [Todo | XS]
- Description: Populate copy (EN/ZH) for Hero/About/Why Us; verify tone.
- Outcome: Presentable preview.
- Dependencies: T-010, T-030, T-080.

---

## Epic E15 — Legal & Policies

T-150 Terms & Privacy pages [Todo | S]
- Description: Draft minimal legal pages; link from footer; consent text in form.
- Outcome: Footer links working; consent checkbox references pages.
- Dependencies: T-020, T-070.

---

## Epic E16 — Release & Monitoring

T-160 Release checklist [Todo | XS]
- Description: Verify Lighthouse, a11y, forms, analytics; tag release.
- Outcome: M1 release live.
- Dependencies: All M1 tasks.

T-161 Post-release monitoring [Todo | XS]
- Description: Watch analytics for first 7 days; capture issues.
- Outcome: Issue list for M2.
- Dependencies: T-091.

---

## Epic P2 — Production Completeness (M3)

P2-201 CMS/DB integration [Todo | L]
- Description: Choose Sanity/Contentful or Supabase; migrate `/data` to CMS/DB; SSR/ISR updates.
- Outcome: Editors can update content without code changes.
- Dependencies: infra, content model finalized.

P2-202 API submissions + email [Todo | M]
- Description: Implement `/api/registrations`; store to DB; Resend confirmation; rate limit + spam filters.
- Outcome: Reliable signup pipeline.
- Dependencies: P2-201.

P2-203 Cloudinary media pipeline [Todo | S]
- Description: Replace local images with Cloudinary; responsive transforms.
- Outcome: Faster media; cache hits.
- Dependencies: none.

P2-204 Sentry integration [Todo | XS]
- Description: Frontend error tracking with DSN; sourcemaps.
- Outcome: Errors visible in dashboard.
- Dependencies: build pipeline.

---

## Tracking Notes
- Each task should become an Issue/PR with the same ID (e.g., `T-041-books-grid`).
- Link Issues to EARS IDs (B01, B02, E01, F01, …) in the description.
- Maintain status updates in PR titles or labels (`in-progress`, `blocked`, etc.).
- Use Vercel preview URLs in PR descriptions for design review.

---

## 2025-09-02 Implementation Log (Phase M1 UI alignment)

- Home page
	- Updated Digital Detox modal to match notebook design (two-column layout + notebook-03 visual). [Done]
	- Verified build succeeds and pages render. [Done]

- Components
	- Fixed WhyUs icons to reference correct filenames; ensured assets present in `public/images/elements`. [Done]

- Testing (ad-hoc)
	- Built project after changes to catch type and compile errors. [Pass]
	- Smoked Home and Events UI locally (no runtime errors). [Pass]

- Next Up
	- T-071: Wire external endpoints for TW/NL forms via env and success state. [Todo]
	- T-090: Route metadata per page + OG images. [Todo]
	- T-110/T-140: Switch hero and gallery images to `next/image` and compress assets. [Todo]

## 2025-09-03 Implementation Log (Hero fine-tune)

- Home Hero
	- Added decorative background elements for large screens to match front page design mood. [Done]
	- Tuned line-height, font sizes, spacing (new spacing tokens 15/18/22) to improve centering balance. [Done]

- Build/Verify
	- Clean rebuild to resolve transient _document error; final build success. [Pass]

## 2025-09-03 Implementation Log (Header alignment)

- Global Header
	- Reworked layout to absolutely center the logo independent of side nav widths. [Done]
	- Adjusted bar height, nav spacing, and language toggle styling to better match front page design. [Done]

---

## 2025-12-13 Implementation Log (URS Gap Analysis & Implementation)

Based on User Requirements Specification (URS) gap analysis, the following features have been implemented:

### New Components Created

T-200 Book Article Page Redesign [Done | M]
- Description: Redesigned `/books/[slug]` page to match Reading Outpost style with white background, sidebar, and article layout.
- Outcome: Full article page with book hero, summary, discussion points, external links, and sidebar (Podcast/Article list/Social links).
- EARS: B02, A01.
- Files: `app/books/[slug]/page.tsx`, `components/BookArticleSidebar.tsx`

T-201 Page Flip Animation [Done | M]
- Description: Implemented page flip animation component for hero section with autoplay and navigation dots.
- Outcome: Animated notebook visual with 3D flip effect; respects reduced-motion preference.
- EARS: H01.
- Files: `components/PageFlipAnimation.tsx`

T-202 Book Carousel [Done | M]
- Description: Replaced BookWall with carousel showing 5 books at a time, smaller size, centered-right position, reverse chronological order.
- Outcome: Carousel with navigation arrows, pagination dots, autoplay; sorted by readDate descending.
- EARS: B01.
- Files: `components/BookCarousel.tsx`

T-203 Section Dividers [Done | XS]
- Description: Added white line separators between homepage sections.
- Outcome: Visual separation between activity blocks.
- EARS: H01.
- Files: `components/SectionDivider.tsx`, `app/page.tsx`

T-204 Event Single Filter [Done | S]
- Description: Events page now supports URL parameter `?event=TW` or `?event=NL` to show only specific event.
- Outcome: Deep-linkable single event signup; hides unrelated events; aligned image with form.
- EARS: E01, F01.
- Files: `app/events/page.tsx`

T-205 Typography Consistency [Done | S]
- Description: Updated fonts across site - CTA buttons use Outfit (uppercase, increased letter-spacing); Our Story/Why Us headers match; Counter uses stable Outfit font.
- Outcome: Consistent typography matching design specs.
- EARS: Multiple.
- Files: `tailwind.config.ts`, `app/layout.tsx`, `app/about/page.tsx`, `components/WhyUs.tsx`, `components/Footer.tsx`, `app/events/page.tsx`

T-206 Footer Optimization [Done | XS]
- Description: Reduced logo size, thinner pink bar, smaller text in footer.
- Outcome: More compact, less obtrusive footer.
- EARS: N01.
- Files: `components/Footer.tsx`

### Updated Homepage
- Replaced static notebook image with PageFlipAnimation component
- Replaced BookWall with BookCarousel (5 books, smaller, centered-right)
- Added SectionDividers between sections
- CTA buttons now use Outfit font with uppercase and letter-spacing

### Event Page Improvements
- Added URL-based event filtering (?event=TW or ?event=NL)
- Image and form now aligned in 2-column grid
- Counter labels and values use Outfit font with stable sizing

### Typography Updates
- Added Outfit font via Google Fonts in layout.tsx
- Updated tailwind.config.ts with font-outfit family
- Applied consistent font-outfit to all headings and CTAs

### Remaining URS Items (Not Implemented - Phase 2)
- Google OAuth login & Admin panel (requires backend infrastructure)
- Payment flow pages (Thank You, Order Details)
- Bank transfer instructions (bilingual)

---

## 2025-12-13 Implementation Log (SEO & i18n Implementation)

T-207 SEO Optimization [Done | S]
- Description: Implemented comprehensive SEO metadata, Open Graph tags, sitemap, robots.txt, and web manifest.
- Outcome: All pages have proper meta tags; good social sharing previews; search engine friendly.
- EARS: Non-Functional SEO.
- Files: `lib/seo.ts`, `app/sitemap.ts`, `public/robots.txt`, `public/site.webmanifest`, `app/layout.tsx`
- Details:
  - Centralized SEO configuration in `lib/seo.ts` with default metadata and per-page overrides
  - Dynamic sitemap generation for static pages and book pages
  - Web manifest for PWA support
  - robots.txt for crawler guidance
  - Open Graph and Twitter Card meta tags

T-208 i18n Bilingual Support [Done | M]
- Description: Implemented full internationalization with next-intl for English and Traditional Chinese.
- Outcome: All UI text is translatable; language toggle persists choice via cookie; no page refresh required.
- EARS: L01.
- Files: `messages/en.json`, `messages/zh.json`, `lib/i18n.ts`, `lib/useLocale.ts`, `components/LangToggle.tsx`, `components/Header.tsx`, `next.config.mjs`
- Details:
  - Translation files with full coverage of nav, home, whyUs, events, books, about, footer, form, modal, sidebar
  - Server-side locale detection from cookie then Accept-Language header
  - Client-side language toggle component integrated into Header
  - next-intl plugin configured in next.config.mjs
  - Locale persisted to cookie for server-side access

### Updated Tasks Status
- T-010 next-intl setup: Done (previously Todo)
- T-011 Language toggle with persistence: Done (previously Todo)
- T-090 Route metadata & OG tags: Done (previously Todo)
