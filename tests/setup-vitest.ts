import '@testing-library/jest-dom/vitest';

// Set test environment variables for Supabase
// These allow tests to run against a local/test database
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-key-for-local-development';
process.env.SUPABASE_REGISTRATIONS_TABLE = 'registrations';
process.env.SUPABASE_EVENTS_TABLE = 'events';
process.env.SUPABASE_EVENT_TYPES_TABLE = 'event_types';
process.env.SUPABASE_BOOKS_TABLE = 'books';