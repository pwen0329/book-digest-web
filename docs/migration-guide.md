# Database Refactor Migration Guide

This document describes the database refactor that moves from the admin_documents key-value pattern to proper relational tables.

## Overview

**Goal**: Refactor the admin system to use proper relational database tables instead of the generic `admin_documents` key-value store.

**Status**: ✅ Complete (Books migrated to database, Events/Capacity/Emails still use admin_documents during transition)

## What Changed

### Before
- Books stored in `admin_documents` table with key='books' as JSON
- Single event per event type (fixed map: TW, NL, EN, DETOX)
- No dedicated venues table
- No event_id tracked in registrations

### After
- Books stored in dedicated `books` table with proper columns
- Multiple events per event type supported
- Dedicated `venues` table for locations
- `event_id` and `book_id` foreign keys in tables
- Settings in dedicated `settings` table

## Database Schema

### Tables Created

1. **venues** - Physical and virtual event locations
   - `id` (BIGSERIAL PRIMARY KEY)
   - `name` (TEXT UNIQUE NOT NULL)
   - `address` (TEXT)
   - `max_capacity` (INTEGER NOT NULL)
   - `is_virtual` (BOOLEAN DEFAULT FALSE)
   - Timestamps: `created_at`, `updated_at`

2. **events** - Event instances with localized content
   - `id` (BIGSERIAL PRIMARY KEY)
   - `slug` (TEXT UNIQUE NOT NULL)
   - `event_type` (TEXT) - TW, NL, ONLINE, DETOX
   - `venue_id` (BIGINT FK → venues)
   - `book_id` (BIGINT FK → books)
   - `event_date` (TIMESTAMPTZ NOT NULL)
   - `title`, `description` (JSONB for zh/en)
   - `poster_src`, `poster_alt` (TEXT/JSONB)
   - `signup_path`, `image_position`, etc.
   - `coming_soon`, `coming_soon_body` (BOOLEAN/JSONB)
   - `is_published` (BOOLEAN DEFAULT TRUE)
   - Timestamps: `created_at`, `updated_at`

3. **books** - Book catalog
   - `id` (BIGSERIAL PRIMARY KEY)
   - `slug` (TEXT UNIQUE NOT NULL)
   - `sort_order` (INTEGER)
   - `title`, `author` (TEXT NOT NULL)
   - `title_en`, `author_en` (TEXT)
   - `read_date` (DATE)
   - `summary`, `summary_en` (TEXT)
   - `reading_notes`, `reading_notes_en` (TEXT)
   - `discussion_points`, `discussion_points_en` (TEXT[])
   - `tags` (TEXT[])
   - `cover_url`, `cover_url_en` (TEXT)
   - `cover_blur_data_url`, `cover_blur_data_url_en` (TEXT)
   - `links` (JSONB) - {publisher, notes}
   - `additional_covers` (JSONB) - {zh: [], en: []}
   - Timestamps: `created_at`, `updated_at`

4. **settings** - Runtime configuration
   - `key` (TEXT PRIMARY KEY)
   - `value` (JSONB NOT NULL)
   - `description` (TEXT NOT NULL)
   - `updated_at` (TIMESTAMPTZ)
   - `updated_by` (TEXT)

5. **registrations** - Updated with FKs
   - Added: `event_id` (BIGINT FK → events)
   - Added: `book_id` (BIGINT FK → books)

## File Structure

### Migrations
- `lib/db/migrations/001_create_venues.sql`
- `lib/db/migrations/002_create_events.sql`
- `lib/db/migrations/003_create_books.sql`
- `lib/db/migrations/004_update_registrations.sql`
- `lib/db/migrations/005_create_settings.sql`
- `lib/db/migrations/006_migrate_admin_documents.sql`

### TypeScript Types
- `types/venue.ts` - Venue, VenueRow, converters
- `types/event.ts` - Event, EventRow, EventType, converters
- `types/book.ts` - Updated Book, BookRow, DraftBook, converters
- `types/settings.ts` - Setting, SettingRow, SettingKey, converters

### Library Functions
- `lib/supabase-utils.ts` - Shared database utilities
  - `shouldForceLocalPersistentStores()` - Check if using local file mode
  - `isSupabaseConfigured()` - Check if database is configured
- `lib/venues.ts` - Venue CRUD operations
- `lib/events.ts` - Event CRUD operations
- `lib/books-db.ts` - Book database operations
  - **Supports file-backed mode**: Falls back to `data/books-v2.json` when database not configured
  - Controlled by `FORCE_LOCAL_PERSISTENT_STORES=1` environment variable
  - Local files stored in `.local/playwright-admin-documents/books-v2.json`
- `lib/settings.ts` - Settings operations
- `lib/capacity-checker.ts` - Capacity checking logic

### API Endpoints (v2)
- `app/api/admin/venues-v2/route.ts` - GET all venues
- `app/api/admin/venue-v2/route.ts` - POST create venue
- `app/api/admin/venue-v2/[id]/route.ts` - GET/PUT/DELETE venue

- `app/api/admin/events-v2/route.ts` - GET all events
- `app/api/admin/event-v2/route.ts` - POST create event
- `app/api/admin/event-v2/[id]/route.ts` - GET/PUT/DELETE event

- `app/api/admin/books-v2/route.ts` - GET all books
- `app/api/admin/book-v2/route.ts` - POST create book
- `app/api/admin/book-v2/[id]/route.ts` - GET/PUT/DELETE book

- `app/api/admin/settings/route.ts` - GET/POST settings

### Admin UI
- `app/admin/page.tsx` - Updated to load books from database
- `components/admin/AdminDashboard.tsx` - Updated books tab to use v2 APIs

## Migration Steps

### Phase 1: Database Setup ✅
1. Run migration SQL files to create tables
2. Run seed data for venues
3. Run data migration from admin_documents to new tables

### Phase 2: Backend Implementation ✅
1. Create TypeScript types
2. Implement library functions
3. Create v2 API endpoints
4. Keep old endpoints for backward compatibility

### Phase 3: Admin UI Migration ✅
1. Update admin page to load books from database
2. Update AdminDashboard books tab to use v2 APIs
3. Support draft books (id=undefined) before saving

### Phase 4: Public Site (Future)
1. Update public book pages to read from database
2. Update event pages to support multiple events per type
3. Remove dependency on admin_documents for books

### Phase 5: Cleanup (Future)
1. Remove old `/api/admin/books` endpoint
2. Migrate events/capacity/emails to database
3. Remove admin_documents table entirely

## API Changes

### Books API Migration

**Old API** (admin_documents pattern):
```typescript
PUT /api/admin/books
Body: {
  books: Book[],
  expectedUpdatedAt: string
}
```

**New API** (REST with database):
```typescript
GET /api/admin/books-v2              // List all
POST /api/admin/book-v2               // Create one
GET /api/admin/book-v2/[id]           // Get one
PUT /api/admin/book-v2/[id]           // Update one
DELETE /api/admin/book-v2/[id]        // Delete one
```

### Key Differences
- No more bulk updates with version tracking
- Individual CRUD operations
- Database handles timestamps automatically
- Numeric IDs instead of string/number union
- `additionalCovers` JSONB instead of `coverUrls` arrays

## Data Model Changes

### Book Type Changes
```typescript
// Old (admin_documents)
type Book = {
  id: string | number;  // Draft books used strings
  coverUrls?: string[];
  coverUrlsEn?: string[];
  // ... (no timestamps)
}

// New (database)
type Book = {
  id: number;  // Always numeric from database
  additionalCovers?: {
    zh?: string[];
    en?: string[];
  };
  createdAt: string;
  updatedAt: string;
}

// Draft (admin UI only)
type DraftBook = Omit<Book, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: number;  // undefined = not yet saved
  createdAt?: string;
  updatedAt?: string;
}
```

## Running Migrations

### Step 1: Create Tables
```sql
-- Run each migration file in order
psql -h <host> -U <user> -d <database> -f lib/db/migrations/001_create_venues.sql
psql -h <host> -U <user> -d <database> -f lib/db/migrations/002_create_events.sql
-- ... etc
```

### Step 2: Migrate Data
```sql
-- Run the migration script
psql -h <host> -U <user> -d <database> -f lib/db/migrations/006_migrate_admin_documents.sql
```

### Step 3: Verify
```sql
SELECT COUNT(*) FROM books;
SELECT COUNT(*) FROM venues;
SELECT COUNT(*) FROM events;
```

## Rollback Plan

If issues arise:

1. **Books**: Old `/api/admin/books` endpoint still works with admin_documents
2. **Data**: admin_documents table not modified by migration
3. **Admin UI**: Can revert git commits to restore old behavior

## Testing Checklist

- [ ] Create new draft book in admin
- [ ] Save draft book to database
- [ ] Update existing book
- [ ] Delete book
- [ ] Reorder books
- [ ] Upload book cover
- [ ] Verify public pages still work
- [ ] Check book detail pages
- [ ] Verify search functionality
- [ ] Test different locales (zh/en)

## Performance Considerations

### Benefits
- ✅ Indexed queries (by slug, by tag, by date)
- ✅ Proper foreign keys
- ✅ Database-level constraints
- ✅ Efficient filtering and sorting
- ✅ No JSON parsing overhead

### Potential Issues
- ⚠️ N+1 queries if not careful (use joins)
- ⚠️ Large TEXT fields (summaries, notes)
- ⚠️ JSONB queries need proper indexing

### Optimizations Applied
- Indexes on: slug (UNIQUE), event_date, event_type
- FK indexes automatically created
- BIGSERIAL for auto-incrementing IDs

## Security

### Added Protections
- Foreign key constraints prevent orphaned records
- CHECK constraints on enums (event_type)
- NOT NULL constraints on critical fields
- ON DELETE RESTRICT for critical relations

### Auth
- All admin endpoints use `isAuthorizedAdminRequest()`
- No change to auth model

## Monitoring

### What to Watch
- Database query performance
- Failed foreign key insertions
- Orphaned records (shouldn't happen with FKs)
- Admin UI errors when saving

### Logging
- All endpoints use `runWithRequestTrace()`
- Errors logged via `logServerError()`

## Future Enhancements

1. **Bulk Operations**: Add batch create/update endpoints
2. **Search**: Add full-text search on books
3. **History**: Track edit history in separate table
4. **Media**: Move images to dedicated storage table
5. **Cache**: Add Redis layer for frequently accessed data

## File-Backed Development Mode

The database functions now support file-backed fallback mode for local development without Supabase:

### How It Works
- Set `FORCE_LOCAL_PERSISTENT_STORES=1` to force local mode
- Books are read from/written to `data/books-v2.json` (seed file)
- Changes persist to `.local/playwright-admin-documents/books-v2.json`
- Pattern matches `loadAdminDocumentRecord` from admin-content-store

### Benefits
- ✅ Develop without database connection
- ✅ Test CRUD operations locally
- ✅ Consistent with existing admin_documents pattern
- ✅ Safe for CI/CD and testing environments

### Seed Data
- `data/books.json` - Legacy format (old admin_documents)
- `data/books-v2.json` - New format with numeric IDs and timestamps
- Generated from books.json using: `jq 'to_entries | map({id: (.key + 1), ...})'`

## Questions & Answers

**Q: Why v2 endpoints instead of updating existing ones?**
A: Allows gradual migration without breaking existing functionality.

**Q: Why BIGSERIAL instead of UUID?**
A: Simpler, more familiar, better performance for sequential access.

**Q: Why TEXT enum instead of PostgreSQL ENUM?**
A: Code owns the enum definition, easier to modify without migrations.

**Q: What happens to old admin_documents?**
A: Kept for backward compatibility during transition, can be removed later.

**Q: Can I still use the old admin UI?**
A: Yes, but the books tab now uses the database. Events/capacity/emails still use admin_documents.

## Support

For issues or questions:
1. Check migration logs in database
2. Check server logs for API errors
3. Verify Supabase permissions
4. Review admin UI console for client errors
