# Feature 002: Merge Venue into Events + Customizable Signup Intro

**Status:** Active  
**Created:** 2026-04-23  
**Owner:** Admin Team

## Overview

This feature consolidates venue management into events (removing the separate venues table) and introduces a dynamic signup intro template system. The goal is to simplify event configuration since venues are rarely reused, while providing flexibility for customizing signup flow messaging.

## Part 1: Merge Venue into Events

### Functional Requirements

**FR-1.1: Inline Venue Configuration**
- As an admin, I want to configure venue details directly within an event (name, name in English, capacity, address, location) so that I don't need to manage venues separately.

**FR-1.2: Payment Configuration**
- As an admin, I want to set payment currency (EUR/TWD/USD) and payment amount for each event so that I can configure the cost per event.
- Payment amount range: 0 to small integer
- Payment amount of 0 means the event is free

**FR-1.3: Optional Venue Fields**
- As an admin, I can leave venue name, name_en, capacity, and address blank when creating an event, since venue details are often decided one week before the event.
- When venue fields are null/empty, the system displays: "Event location will be informed one week before the event happens"
- Venue location (TW/NL/ONLINE) is always required

**FR-1.4: Venue Attributes**
- Venue name (text, optional)
- Venue name English (text, optional)
- Venue capacity (integer, optional)
- Venue address (text, optional)
- Venue location (enum: TW, NL, ONLINE - required)

### Non-Functional Requirements

**NFR-1.1: Database Schema**
- Remove venues table entirely
- Store venue fields directly in events table
- Venue location: NOT NULL, CHECK IN ('TW', 'NL', 'ONLINE')
- Venue capacity: nullable, CHECK > 0 when not null
- Payment currency: NOT NULL, DEFAULT 'TWD', CHECK IN ('EUR', 'TWD', 'USD')
- Payment amount: NOT NULL, DEFAULT 0
- No null handling needed for payment amount (always 0 or positive integer)

**NFR-1.2: Data Migration**
- Admin manually configures venue info for existing events (no automatic migration script)
- Venue info defaults to null for optional fields

**NFR-1.3: Display Logic**
- If venue_name AND venue_address are null/empty: show default message
- If venue_location is set: always display location (required field)

## Part 2: Customizable Signup Intro Templates

### Functional Requirements

**FR-2.1: Template Management**
- As an admin, I want to create, update, and delete signup intro templates so that I can reuse common messaging patterns.
- Templates have a unique name and support both Chinese and English content

**FR-2.2: Template Selection**
- As an admin, I want to select an intro template when creating/editing an event so that the signup page displays customized messaging.

**FR-2.3: Template Types**
- Templates can be marked as "free event" or "paid event"
- Paid event templates must include {{payment_currency}} and {{payment_amount}} variables
- System validates that paid templates contain required variables

**FR-2.4: Variable Interpolation**
- Templates support variable placeholders: {{payment_currency}}, {{payment_amount}}
- Optional variables: {{event_name}}, {{venue_name}}, {{event_date}}
- Variables are replaced with actual event data when displaying the intro

**FR-2.5: Template Preview**
- As an admin, I want to see a preview of the interpolated content in the template manager modal so that I can verify the template looks correct before saving.

**FR-2.6: Default Template**
- System creates a default paid event template with the current hardcoded intro text
- Events without a selected template use the default template

### Non-Functional Requirements

**NFR-2.1: Database Schema**
- Table: `event_signup_intros`
  - `name` (text, PRIMARY KEY) - unique template identifier
  - `content` (text, NOT NULL) - Chinese intro text
  - `content_en` (text, NOT NULL) - English intro text
  - `is_free` (boolean, NOT NULL) - whether template is for free events
- Events table:
  - `intro_template_name` (text, FK → event_signup_intros.name, nullable)
  - FK constraint: ON DELETE SET NULL (removing template clears event reference)

**NFR-2.2: Template Validation**
- Paid templates (is_free = false) must include {{payment_currency}} and {{payment_amount}}
- Validation runs on template create/update
- Validation checks both `content` and `content_en` fields
- Display validation errors in the template manager UI

**NFR-2.3: Interpolation**
- Use {{variable_name}} syntax for placeholders
- Handle missing/null values gracefully (replace with empty string)
- Reuse existing interpolation utility from email templates
- Interpolation context includes: payment_currency, payment_amount, event_name, venue_name, venue_location, event_date

**NFR-2.4: Admin UI**
- Modal component for template management
- List view shows all templates with name and type (free/paid)
- Form includes: name input, content textarea (Chinese), content_en textarea (English), is_free checkbox
- Live preview panel shows interpolated result with sample data
- Delete requires confirmation
- Event edit form includes dropdown to select template

**NFR-2.5: Signup Flow Integration**
- Fetch event with intro template when loading signup page
- Display interpolated intro in INTRO step
- Fallback to translation keys if template is null (backward compatibility)

## Part 3: Preview Signup Flow (Deferred)

**Note:** Preview functionality is deferred for discussion after Parts 1 and 2 are complete.

### Placeholder Requirements

**FR-3.1: Preview Access**
- As an admin, I want to preview the signup flow for an event before publishing so that I can verify venue and intro content is correct.

**Discussion needed:**
- Preview availability (before/after publish?)
- Preview UI (modal, separate page, inline?)
- Preview scope (intro only or full 3-step flow?)
- Interactive vs static preview

## Acceptance Criteria

### Part 1: Venue & Payment
- [ ] Admin can create event with inline venue fields (name, capacity, address, location)
- [ ] Admin can set payment currency and amount
- [ ] Payment amount defaults to 0 for free events
- [ ] Venue location is required, other venue fields are optional
- [ ] When venue fields are empty, signup page shows default message
- [ ] Existing venue table is removed from database
- [ ] Registration capacity calculation uses event.venue_capacity

### Part 2: Intro Templates
- [ ] Admin can create intro templates with name, content (zh), content_en, is_free
- [ ] Admin can update and delete templates
- [ ] Paid templates must include {{payment_currency}} and {{payment_amount}}
- [ ] Validation errors display when required variables are missing
- [ ] Admin can select template in event form
- [ ] Template manager modal shows list and preview
- [ ] Signup page displays interpolated intro content
- [ ] Variables are replaced with actual event data
- [ ] Default template exists and is used when no template selected

## Dependencies

- Existing payment fields in events table (already exist, need UI exposure)
- Existing interpolation utility in lib/email-templates.ts (can be reused)
- ActivitySignupFlow component (needs update to accept event data and render dynamic intro)

## Out of Scope

- Automatic venue data migration (admin manual configuration)
- Rich text / markdown support in templates (plain text only)
- Template versioning or history
- Template sharing across different event types
- Preview signup flow (Part 3, deferred)

## Technical Notes

- Payment fields already exist in database from previous migration
- Template interpolation can reuse existing email template utility
- Venue location enum values remain consistent: 'TW', 'NL', 'ONLINE'
- Default intro template should be created in migration with current hardcoded text
