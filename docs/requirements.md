# Book Digest — Product Requirements (EARS)

Version: 0.1 (2025-09-02)
Owner: Product/Eng

## Goals
- Communicate what Book Digest is, why it exists, and how it’s different.
- Showcase past reads and community activities.
- Enable event/signup collection (TW or NL seat registration) with minimal friction.
- Ship quickly for UI validation, then harden for production.

## Roles & Locales
- Roles: Visitor (anonymous), Applicant (submits a form), Admin (content curator; future scope).
- Locales: English (en), Traditional Chinese (zh-TW). Language switch persists across pages.

## Assumptions
- Visual direction follows provided assets in `docs/ui/` and `logo.svg`.
- Book covers exist or can fall back to branded placeholders.
- Book detail delivered via accessible modal; modal is deep-linkable as `/books/{slug}`.
- Two forms represent two locations (TW, NL); only one must be submitted per applicant.

## Non-Goals (initial)
- No auth, payments, or member portal.
- No full CMS in phase 1; JSON/flat data is fine and replaceable.

## IA (high level)
- Global: Header (Books, Events, About Us, Join Us / Forms, Lang EN/CH), Footer (Podcast, Instagram, Email, Contact, Terms, Privacy).
- Pages/Sections: Home, Books, Events, About, Join/Forms, Contact, Legal.

## Non-Functional
- Accessibility: WCAG 2.1 AA (contrast, focus, keyboard, reduced-motion).
- Performance: LCP ≤ 2.5s on 4G; lazy image loading; responsive images.
- SEO: Titles/descriptions per route, OG tags, sitemap, robots.txt.
- Observability: Privacy-first analytics; error logging for client.

---

## User Stories with EARS Acceptance Criteria

ID: B01 — Browse past books (grid)
- When the visitor opens the Books page, the system shall render a responsive grid of book cards showing cover, title, author, and read month/year.
- When a cover image is missing, the system shall display a branded placeholder with the title text.
- While data is loading, the system shall display skeleton placeholders.
Acceptance criteria
- Given ≥ 12 books and viewport ≥ 1024px, when rendered, then grid shows 4–5 columns; at 640–1023px, 2–3 columns; at < 640px, 1–2 columns.
- Given a book missing image, when rendered, then a placeholder with accessible alt text appears and layout remains consistent.
- Given slow network, when data is pending, then skeletons are shown and removed once data arrives with CLS ≤ 0.1.

ID: B02 — Book details (modal + deep link)
- When a book card is clicked, the system shall open an accessible modal showing cover, title, author, date read, reading experience summary, tags, and outbound links (publisher, notes).
- When the modal opens, the system shall trap focus and close via Esc, overlay click, or Close button.
- When the URL contains `/books/{slug}`, the system shall open the corresponding modal on page load.
Acceptance criteria
- Given keyboard-only usage, when modal opens, then focus is inside and Tab/Shift+Tab cycles within.
- Given a deep-link URL, when loaded, then the modal content matches the slug and Back closes the modal back to the grid state.
- Given prefers-reduced-motion, when opening, then animations are reduced/disabled.

ID: N01 — Social and contact links
- When header and footer render, the system shall display links to Podcast, Instagram, Email (mailto), and Contact page.
- When an external social link is clicked, the system shall open it in a new tab and include `rel="noopener noreferrer"`.
Acceptance criteria
- Given external links, when clicked, then target is `_blank` with a visible focus state.
- Given email link, when clicked, then a `mailto:` opens with subject "Book Digest Inquiry".

ID: E01 — Events metrics animation
- When the Events counters come into viewport, the system shall animate numbers from 0 to configured targets (reading days, book clubs held, readers joined) within 0.8–1.8 seconds.
- When prefers-reduced-motion is set, the system shall render final numbers without animation.
Acceptance criteria
- Given counters off-screen, when scrolled into view ≥ 50% height, then animation starts once per session and does not restart on minor scroll.
- Given reduced-motion, when in view, then numbers appear instantly.

ID: F01 — Event signup forms (TW / NL)
- When the Events page is loaded, the system shall display two forms (TW and NL) or a toggle to select location, requiring only one submission.
- When required fields are valid, the system shall submit to a configurable endpoint.
- When submission succeeds, the system shall show a success message and clear PII from client state.
Fields
- firstName, lastName, age, profession, email, instagram (optional), referral (Instagram | Facebook | Others), referralOther (required when referral=Others), consent checkbox.
Validation (EARS)
- When age is entered, the system shall accept integers in [13, 120] else show an inline error.
- When email is entered, the system shall validate format per RFC 5322 relaxed and reject malformed input.
- When referral = Others, the system shall require `referralOther` with min length 2.
- When submitting, the system shall include a honeypot field and silently discard if filled.
Acceptance criteria
- Given only TW form is filled, when submitted, then NL form is not required and submission is accepted.
- Given invalid email, when submit is clicked, then submit is blocked and error is announced via aria-live.
- Given an HTTP 200/201 response, when returned, then success UI appears and data layer logs a conversion without PII.

ID: H01 — Home hero and gallery
- When the Home page loads, the system shall render the hero text, two CTAs (Book Club, Digital Detox), and scrapbook imagery as per design.
- When CTAs are clicked, the system shall route to Events (forms) and the detox section/page.
Acceptance criteria
- Given mobile viewport, when rendered, then hero text remains ≥16px and CTAs provide 44x44px hit area with visible focus.

ID: A01 — About / Why Us
- When the About page loads, the system shall render story copy and "Why Us" points consistent with provided designs.
Acceptance criteria
- Given long copy, when rendered, then headings use semantic h1–h3 and are linkable.

ID: L01 — Language switch and persistence
- When the language toggle is clicked, the system shall switch UI strings and content while preserving the current route (and open modal state if applicable).
- When the site is revisited, the system shall respect saved language or browser preference.
Acceptance criteria
- Given a book deep-link, when language changes, then the same book remains shown with localized fields if available.

ID: S01 — Error and empty states
- When the book list is empty, the system shall display a friendly empty state and a link to Contact.
- When form submission fails (network or server), the system shall present a retry option and a fallback `mailto:` link.

ID: P01 — Analytics and privacy
- When any page loads, the system shall log a pageview via a privacy-first tool without cookies by default.
- When a form is submitted, the system shall log a conversion event with no PII.

---

## Data Model (initial)
Book
- id, slug, title, author, coverUrl, readDate, summary, tags[], links{ publisher?, notes? }
EventStats
- readingDays, clubsHeld, readersJoined
FormSubmission
- location (TW|NL), firstName, lastName, age, profession, email, instagram?, referral, referralOther?, consent:boolean, timestamp

## Accessibility Checklist (extract)
- Focus-visible on interactive elements; keyboard trap in modals; aria-modal.
- Color contrast ≥ 4.5:1; descriptive alt text; avoid text over busy images.

## Risks & Mitigations
- Image performance: responsive sizes + lazy load; later CDN (Cloudinary) if needed.
- Form spam: honeypot now; consider hCaptcha later.
- Content sprawl: start with JSON schema; migrate to CMS in phase 2.

---

## Tech Stack & Deployment Path

Phase 1 — Fast UI validation
- Framework: Next.js (App Router) + React + Tailwind CSS for rapid theming.
- Animation: Framer Motion (counters, subtle transitions) with `prefers-reduced-motion` guards.
- i18n: `next-intl` (file-based translations).
- Data: Local JSON in `/data`; images in `/public` or uploaded to a simple asset host.
- Forms: A simple serverless endpoint with rate limit + honeypot.
- Hosting: Vercel with preview deployments on PRs.

Phase 2 — Production completeness
- Content: Sanity/Contentful headless CMS or Supabase Postgres for books/events.
- Forms: Next.js API routes persisting to Supabase; email via Resend; optional hCaptcha.
- Media: Cloudinary for responsive transforms and caching.
- Analytics: Plausible/Umami; Error tracking: Sentry.
- i18n: locale routes `/en`, `/zh` with persisted preference.

## Definition of Done (excerpt)
- All EARS criteria above (B01–L01) pass on desktop and mobile.
- Lighthouse: Performance ≥ 85, Accessibility ≥ 95, SEO ≥ 90 on Home/Books/Events.
- Forms: Submissions visible in chosen store; success and failure UX present.

## Traceability
- IDs (B01, B02, N01, E01, F01, H01, A01, L01, S01, P01) map to backlog tickets, commits, and tests.

## Open Questions
- Copy length for "reading experiences"; per-book language availability.
- Exact targets for counters (initial values and update cadence).
