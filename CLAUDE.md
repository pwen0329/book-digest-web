# Claude Instructions - Book Digest Web

## Project Overview

This is a Next.js application for Book Digest, a book club platform with event management, user registration, and admin tools.

**Tech Stack:**
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Supabase (Database)
- Playwright (E2E testing)
- Vitest (Unit/Component testing)

## Testing

### Quick Commands

```bash
# Type Checking
npx tsc --noEmit                     # TypeScript type check

# Unit/Component Tests
npm run test:components              # Run all unit tests
npm run test:components:watch        # Watch mode

# E2E Tests  
npm run test:e2e                     # Run all e2e tests (all browsers)

# Build
npm run build                        # Production build with type checking
```

### Running Unit/Component Tests (Vitest)

```bash
# Run all unit/component tests
npm run test:components

# Run in watch mode
npm run test:components:watch

# Run specific test file
npm run test:components -- tests/lib/books-db.test.ts

# Run tests by directory
npm run test:components -- tests/lib
npm run test:components -- tests/api
npm run test:components -- tests/components
```

### Running E2E Tests (Playwright)

```bash
# Run all e2e tests (across all browsers: chromium, firefox, webkit, Mobile Chrome, Mobile Safari)
npm run test:e2e

# Run tests for specific browser
npm run test:e2e -- --project=chromium
npm run test:e2e -- --project=firefox
npm run test:e2e -- --project=webkit
npm run test:e2e -- --project="Mobile Chrome"
npm run test:e2e -- --project="Mobile Safari"

# Run specific test file
npm run test:e2e -- tests/e2e/admin-v2.spec.ts
npm run test:e2e -- tests/e2e/basic.spec.ts

# Run in UI mode (interactive)
npx playwright test --ui

# Show test report
npx playwright show-report
```

### Test Coverage

#### Unit/Component Tests (Vitest)
- **Location**: `tests/components/`, `tests/lib/`, `tests/api/`
- **Files**: 24 test files
- **Tests**: 143 passing, 10 skipped (153 total)

**Library Tests** (`tests/lib/`):
- `books-db.test.ts` (15 tests) - Book CRUD operations
- `venues.test.ts` (10 tests) - Venue management
- `events.test.ts` (26 tests) - Event management and registration status calculation

**API Tests** (`tests/api/`):
- `admin-books-v2.test.ts` (3 tests) - GET /api/admin/books-v2
- `admin-events-v2.test.ts` (6 tests) - GET /api/admin/events-v2
- `admin-venues-v2.test.ts` (3 tests) - GET /api/admin/venues-v2
- `admin-book-v2-create.test.ts` (6 tests) - POST /api/admin/book-v2
- `admin-event-v2-create.test.ts` (7 tests) - POST /api/admin/event-v2
- `events-public.test.ts` (6 tests) - GET /api/events
- `event-register.test.ts` (18 tests) - POST /api/event/[slug]/register

**Component Tests** (`tests/components/`):
- Admin components, form flows, UI elements
- Registration success email, rate limiting
- Event registration status, locale switching

#### E2E Tests (Playwright)
- **Location**: `tests/e2e/`
- **Files**: 5 test files
- **Tests**: 120 passing across 5 browser projects
- **Browsers**: Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari

**E2E Test Files**:
- `admin-v2.spec.ts` (61 tests) - Comprehensive admin API and registration flow tests
  - Full event lifecycle: book → venue → event creation
  - Multi-step registration form (intro → form → bank account)
  - Registration state validation (upcoming, open, closed, full)
  - Foreign key constraint testing
  - Bank account field verification in admin portal
- `basic.spec.ts` - Basic navigation and page loads
- `header-utilities.spec.ts` - Header, dropdown navigation, language selector
- `mobile-header.spec.ts` - Mobile header, menu, navigation
- `activities.spec.ts` - Activity signup flow

### Test Environment

Tests run in test mode with:
- `ADMIN_PASSWORD=test-admin` - Bypasses rate limiting for admin endpoints
- `NODE_ENV=test` - Uses test configuration

### Coverage Areas

✅ **Admin Functions (CRUD)**
- Books: Create, Read, Update, Delete, Bulk Update
- Events: Create, Read, Update, Delete, Filter, Calculate Status

✅ **User Functions**
- Event registration flow
- Registration status calculation (UPCOMING, OPEN, CLOSED, FULL)
- Rate limiting
- Turnstile bot verification
- Honeypot spam detection
- Multi-step form with bank account payment

✅ **APIs**
- Admin API endpoints with authorization
- Public API endpoints
- Event registration endpoint
- Validation and error handling
- Cache revalidation

✅ **UI/UX**
- Desktop and mobile navigation
- Language switching
- Event filtering and tabs
- Header dropdowns
- Responsive design

## Important Notes for Development

### Git Commits
- **NEVER add Co-Authored-By line** - User does not want "Co-Authored-By: Claude" in commits

### Testing Before Push
Always run these checks before pushing:
```bash
npm run build           # Verify build succeeds
npm run test:components # Verify unit tests pass
npm run test:e2e       # Verify e2e tests pass
```

### Admin API Security
- Registrations API is at `/api/admin/registrations` (not public)
- All admin endpoints require `Authorization: Bearer` token
- Rate limiting is bypassed in test environment only

### Database Schema
- Tables are ordered by FK dependencies (registrations comes after events)
- Venue deletion restricted when referenced by events (ON DELETE RESTRICT)
- Book deletion sets event.book_id to NULL (ON DELETE SET NULL)

## Documentation

Additional documentation available in `docs/`:
- `admin-api-v2.md` - Admin API documentation
- `design.md` - System design
- `migration-guide.md` - Migration guides
- `supabase-deployment-checklist.md` - Deployment steps
