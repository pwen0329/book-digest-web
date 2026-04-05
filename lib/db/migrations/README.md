# Database Migrations

This directory contains SQL migration files for the database refactor.

## Migration Order

Run migrations in numerical order:

1. `001_create_venues.sql` - Creates venues table with seed data
2. `002_create_events.sql` - Creates events table with FK to venues
3. `003_create_books.sql` - Creates books table, adds FK from events to books
4. `004_update_registrations.sql` - Adds event_id and book_id to registrations
5. `005_create_settings.sql` - Creates settings table with initial values
6. `006_migrate_admin_documents.sql` - Migrates data from admin_documents

## How to Run

### Using psql
```bash
psql -h your-host -U your-user -d your-database -f 001_create_venues.sql
psql -h your-host -U your-user -d your-database -f 002_create_events.sql
# ... repeat for each file
```

### Using Supabase CLI
```bash
supabase db push
```

### Using Supabase Dashboard
1. Go to SQL Editor
2. Copy contents of migration file
3. Execute

## Idempotent Migrations

All migrations use `CREATE TABLE IF NOT EXISTS` and check for existing columns/constraints before adding them. This makes migrations safe to run multiple times.

## Rollback

To rollback, drop tables in reverse order:
```sql
DROP TABLE IF EXISTS settings CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS books CASCADE;
DROP TABLE IF EXISTS venues CASCADE;
-- registrations table is not dropped, only columns removed
```

## Seed Data

`001_create_venues.sql` includes seed data for common venues:
- Taiwan Office (Physical, 20 capacity)
- Netherlands Office (Physical, 15 capacity)
- Detox Center (Physical, 25 capacity)
- Online (Virtual, 1000 capacity)

## Notes

- All tables use BIGSERIAL for auto-incrementing IDs
- Foreign keys use ON DELETE RESTRICT to prevent accidental deletions
- Timestamps default to NOW()
- JSONB is used for flexible nested data (localized text, links, etc.)
- PostgreSQL arrays are used for tags and discussion points
