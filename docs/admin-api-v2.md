# Database Refactor - Admin API Endpoints (v2)

This document describes the new REST API endpoints created for database-first operations.

## API Structure

Following REST conventions:
- **Plural endpoints** for collections: `/api/admin/{resource}s-v2`
- **Singular endpoints** for individual operations: `/api/admin/{resource}-v2` and `/api/admin/{resource}-v2/[id]`
- **ID in path** (not query parameters) for resource-specific operations

## Venues API

### GET /api/admin/venues-v2
List all venues.

**Response:**
```json
{
  "venues": [
    {
      "id": 1,
      "name": "Taiwan Office",
      "address": "123 Main St, Taipei",
      "maxCapacity": 20,
      "isVirtual": false,
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### POST /api/admin/venue-v2
Create a new venue.

**Request:**
```json
{
  "name": "New Venue",
  "address": "456 Oak St",
  "maxCapacity": 30,
  "isVirtual": false
}
```

**Response:** `201 Created`

### GET /api/admin/venue-v2/[id]
Get a specific venue by ID.

### PUT /api/admin/venue-v2/[id]
Update a specific venue.

### DELETE /api/admin/venue-v2/[id]
Delete a specific venue.

## Events API

### GET /api/admin/events-v2
List all events with optional filtering.

**Query Parameters:**
- `eventType`: Filter by event type (TW, NL, ONLINE, DETOX)
- `isPublished`: Filter by published status (true/false)

**Response:**
```json
{
  "events": [
    {
      "id": 1,
      "slug": "tw-jan-2024",
      "eventType": "TW",
      "venueId": 1,
      "venue": { ... },
      "bookId": 10,
      "book": { ... },
      "title": { "zh": "台灣讀書會", "en": "Taiwan Book Club" },
      "description": { "zh": "...", "en": "..." },
      "eventDate": "2024-01-15T10:00:00Z",
      "signupPath": "/signup/tw",
      "posterSrc": "/images/posters/tw-jan.jpg",
      "posterAlt": { "zh": "...", "en": "..." },
      "imagePosition": "left",
      "comingSoon": false,
      "isPublished": true,
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### POST /api/admin/event-v2
Create a new event.

**Request:**
```json
{
  "slug": "tw-feb-2024",
  "eventType": "TW",
  "venueId": 1,
  "bookId": 11,
  "title": { "zh": "二月讀書會", "en": "February Book Club" },
  "description": { "zh": "...", "en": "..." },
  "eventDate": "2024-02-15T10:00:00Z",
  "signupPath": "/signup/tw",
  "posterSrc": "/images/posters/tw-feb.jpg",
  "posterAlt": { "zh": "...", "en": "..." },
  "imagePosition": "left",
  "comingSoon": false,
  "isPublished": true
}
```

**Validation:**
- If `comingSoon` is true, `comingSoonBody` is required

**Response:** `201 Created`

### GET /api/admin/event-v2/[id]
Get a specific event by ID (includes venue and book data).

### PUT /api/admin/event-v2/[id]
Update a specific event.

### DELETE /api/admin/event-v2/[id]
Delete a specific event.

## Books API

### GET /api/admin/books-v2
List all books (sorted by read date descending).

**Response:**
```json
{
  "books": [
    {
      "id": 1,
      "sortOrder": 100,
      "slug": "sapiens",
      "title": "人類大歷史",
      "titleEn": "Sapiens",
      "author": "哈拉瑞",
      "authorEn": "Yuval Noah Harari",
      "coverUrl": "/images/books/sapiens.jpg",
      "additionalCovers": {
        "zh": ["/images/books/sapiens-alt.jpg"],
        "en": ["/images/books_en/sapiens.jpg"]
      },
      "readDate": "2024-01-15",
      "summary": "...",
      "readingNotes": "...",
      "discussionPoints": ["...", "..."],
      "tags": ["history", "science"],
      "links": {
        "publisher": "https://...",
        "notes": "/notes/sapiens"
      },
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### POST /api/admin/book-v2
Create a new book.

**Request:**
```json
{
  "slug": "new-book",
  "title": "新書",
  "titleEn": "New Book",
  "author": "作者",
  "authorEn": "Author",
  "coverUrl": "/images/books/new.jpg",
  "readDate": "2024-03-01",
  "summary": "...",
  "tags": ["fiction"]
}
```

**Response:** `201 Created`

### GET /api/admin/book-v2/[id]
Get a specific book by ID.

### PUT /api/admin/book-v2/[id]
Update a specific book.

### DELETE /api/admin/book-v2/[id]
Delete a specific book.

## Settings API

### GET /api/admin/settings
List all settings.

**Query Parameters:**
- `key`: Get a specific setting by key

**Response:**
```json
{
  "settings": [
    {
      "key": "registration_email_enabled",
      "value": true,
      "description": "Enable/disable registration confirmation emails",
      "updatedAt": "2024-01-01T00:00:00Z",
      "updatedBy": "admin@example.com"
    }
  ]
}
```

### POST /api/admin/settings
Create or update a setting (upsert).

**Request:**
```json
{
  "key": "max_daily_registrations",
  "value": 50,
  "description": "Maximum registrations per day",
  "updatedBy": "admin@example.com"
}
```

**Response:** `200 OK`

## Authentication

All endpoints require admin authentication via `isAuthorizedAdminRequest()`.

Unauthorized requests return:
```json
{
  "error": "Unauthorized"
}
```
**Status:** `401 Unauthorized`

## Error Handling

### Validation Errors
**Status:** `400 Bad Request`
```json
{
  "error": "Validation error message"
}
```

### Not Found
**Status:** `404 Not Found`
```json
{
  "error": "Resource not found"
}
```

### Server Errors
**Status:** `500 Internal Server Error`

Foreign key constraint violations and other database errors will bubble up with appropriate error messages.

## Cache Revalidation

All write operations (POST, PUT, DELETE) automatically revalidate relevant Next.js paths:
- Book operations: `/`, `/zh`, `/en`, `/zh/books`, `/en/books`, `/sitemap.xml`, book detail pages
- Event operations: `/zh/events`, `/en/events`, `/zh/signup`, `/en/signup`, `/zh/engclub`, `/en/engclub`, `/zh/detox`, `/en/detox`
- Venue operations: Same as event routes
- Settings operations: Event and signup routes

## Migration Strategy

The v2 endpoints are designed for gradual migration:

1. **Current state:** Legacy endpoints use `admin_documents` pattern
2. **Transition:** New v2 endpoints use database directly
3. **Next steps:**
   - Update admin UI to use v2 endpoints
   - Migrate data from admin_documents to database tables
   - Eventually replace old endpoints with v2
