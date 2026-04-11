# Test Coverage Summary

## New Test Files Added

This document summarizes the comprehensive test coverage added for admin functions, user functions, and APIs.

### Library Tests (`tests/lib/`)

#### 1. `books-db.test.ts` (15 tests)
Tests for book database CRUD operations:
- **getAllBooksFromDB**: Fetching all books with custom ordering
- **getBookByIdFromDB**: Fetching book by ID, handling not found cases
- **getBookBySlugFromDB**: Fetching book by slug with URL encoding
- **createBookInDB**: Creating books with full and minimal fields
- **updateBookInDB**: Updating existing books with partial updates
- **deleteBookFromDB**: Deleting books by ID
- **bulkUpdateBooksInDB**: Bulk updating multiple books

#### 2. `venues.test.ts` (10 tests)
Tests for venue database operations:
- **getAllVenues**: Fetching all venues sorted by name
- **getVenueById**: Fetching venue by ID, handling not found cases
- **createVenue**: Creating venues with optional English names
- **updateVenue**: Updating venues with partial fields
- **deleteVenue**: Deleting venues and FK constraint handling

#### 3. `events.test.ts` (26 tests)
Tests for event management and registration status:
- **getAllEvents**: Fetching with filters (eventType, isPublished, from date, venueLocation)
- **getEventById**: Fetching by ID with optional joins
- **getEventBySlug**: Fetching by slug with URL encoding
- **createEvent**: Creating new events
- **updateEvent**: Updating existing events
- **deleteEvent**: Deleting events with FK constraints
- **calculateRegistrationStatus**: Testing all registration states (UPCOMING, CLOSED, FULL, OPEN, UNKNOWN)
- **getEventsByVenueAndType**: Filtering and sorting by venue and type

### API Tests (`tests/api/`)

#### 4. `admin-books-v2.test.ts` (3 tests)
Tests for GET /api/admin/books-v2:
- Authorization checks (401 for unauthorized)
- Fetching all books when authorized
- Handling empty results

#### 5. `admin-events-v2.test.ts` (6 tests)
Tests for GET /api/admin/events-v2:
- Authorization checks
- Fetching all events
- Filtering by eventTypeCode parameter
- Filtering by isPublished parameter
- Combining multiple filters

#### 6. `admin-venues-v2.test.ts` (3 tests)
Tests for GET /api/admin/venues-v2:
- Authorization checks
- Fetching all venues
- Handling empty results

#### 7. `admin-book-v2-create.test.ts` (6 tests)
Tests for POST /api/admin/book-v2:
- Authorization checks
- Creating books with valid payload
- Cache revalidation after creation
- Invalid JSON handling
- JsonRequestError handling
- Creating books with optional fields

#### 8. `admin-event-v2-create.test.ts` (7 tests)
Tests for POST /api/admin/event-v2:
- Authorization checks
- Creating events with valid payload
- Cache revalidation after creation
- Invalid JSON handling
- JsonRequestError handling
- Creating events with optional fields
- Datetime validation

#### 9. `events-public.test.ts` (6 tests)
Tests for GET /api/events (public endpoint):
- Always returns only published events
- Filtering by venueLocation
- Invalid venueLocation validation
- Accepting valid locations (TW, NL, ONLINE)
- Enforcing isPublished=true regardless of URL params
- Handling empty results

#### 10. `event-register.test.ts` (18 tests)
Tests for POST /api/event/[slug]/register:
- **Rate limiting**: Returns 429 when rate limited
- **Event validation**: 404 for non-existent/unpublished events
- **Registration status**: 409 for UPCOMING, CLOSED, FULL status
- **Payload validation**: Invalid JSON, missing fields, invalid email/age/bank account
- **Honeypot**: Silent success for bot requests
- **Turnstile verification**: 403 for failed verification
- **Successful registration**: Creating reservations, firstName/lastName support
- **Tally forwarding**: Forwarding to external endpoint, handling failures (502)

## Configuration Changes

### `vitest.config.ts`
Updated test file pattern from:
```typescript
include: ['tests/components/**/*.test.ts?(x)']
```

To:
```typescript
include: ['tests/**/*.test.ts?(x)']
```

This allows tests in `tests/lib/` and `tests/api/` directories to run.

## Test Statistics

- **Total new test files**: 10
- **Total new tests**: 100
- **Combined with existing tests**: 153 tests (143 passing, 10 skipped)
- **Test coverage areas**:
  - Admin CRUD operations: Books, Events, Venues
  - User registration flow
  - Public API endpoints
  - Library utility functions
  - Registration status calculation

## Running Tests

```bash
# Run all tests
npm run test:components -- --run

# Run specific test file
npm run test:components -- tests/lib/books-db.test.ts --run

# Run tests by directory
npm run test:components -- tests/lib --run
npm run test:components -- tests/api --run

# Watch mode
npm run test:components:watch
```

## Coverage Areas

### 1. Admin Functions (CRUD)
- ✅ Books: Create, Read, Update, Delete, Bulk Update
- ✅ Venues: Create, Read, Update, Delete
- ✅ Events: Create, Read, Update, Delete, Filter, Calculate Status

### 2. User Functions
- ✅ Event registration flow
- ✅ Registration status calculation (UPCOMING, OPEN, CLOSED, FULL)
- ✅ Rate limiting
- ✅ Turnstile bot verification
- ✅ Honeypot spam detection

### 3. APIs
- ✅ Admin API endpoints with authorization
- ✅ Public API endpoints
- ✅ Event registration endpoint
- ✅ Validation and error handling
- ✅ Cache revalidation

All tests follow best practices with proper mocking using `vi.hoisted()` for module-level mock setup.
