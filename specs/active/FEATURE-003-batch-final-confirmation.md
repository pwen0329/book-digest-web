# FEATURE-003: Batch Final Confirmation Email to Ready Users

**Status**: Draft  
**Created**: 2026-04-29  
**Author**: Engineering Team  
**Epic**: Email & Communication

## Overview

### Summary
Implement batch email functionality to send final confirmation/notification emails to confirmed registrations before an event. This feature allows admins to:
1. Select multiple confirmed registrations for a specific event
2. Customize email templates (ZH/EN) with persistent storage
3. Send batch emails with progress tracking
4. Update registration status from `confirmed` to `ready` upon successful delivery

### Business Value
- **Event Management**: Streamline final notifications before events
- **Admin Efficiency**: Batch operations instead of individual emails
- **User Experience**: Clear final confirmation with event details
- **Compliance**: Audit trail for all final confirmations sent

### Dependencies
- Existing: Email service infrastructure from FEATURE-001
- Existing: Admin registrations page (`app/admin/registrations/page.tsx`)
- Existing: Registration store and types (`lib/registration-store.ts`)
- New: `ready` status in registration status enum

---

## User Stories

### US-001: Batch Selection of Confirmed Registrations
**As an** admin  
**I want** to select multiple confirmed registrations for a specific event  
**So that** I can send final confirmation emails in batch

**Acceptance Criteria (EARS)**:
- **Event**: When admin filters registrations by a specific event
- **Action**: Admin sees checkboxes for each registration row
- **Response**: Checkboxes enabled only for registrations with `confirmed` status
- **State**: Admin can select/deselect individual rows or use header checkbox for select-all

**GIVEN** admin is on registrations page with event filter set to a specific event  
**WHEN** page displays filtered registrations  
**THEN** checkbox column appears as first column in table  
**AND** header checkbox allows select-all/deselect-all for confirmed registrations  
**AND** row checkboxes are enabled only for registrations with status `confirmed`  
**AND** row checkboxes are disabled for registrations with status `pending`, `cancelled`, or `ready`

**GIVEN** admin has event filter set to "ALL"  
**WHEN** page displays registrations from multiple events  
**THEN** checkbox column does not appear  
**AND** batch actions are not available

---

### US-002: Send Final Confirmation Button
**As an** admin  
**I want** to see a "Send Final Confirmation" button when I have selected confirmed registrations  
**So that** I can proceed to send batch emails

**Acceptance Criteria (EARS)**:
- **Event**: When admin selects one or more confirmed registrations
- **Action**: "Send Final Confirmation" button becomes visible and enabled
- **Response**: Button shows count of selected registrations
- **State**: Button positioned left of "Export CSV" button

**GIVEN** admin has selected at least one confirmed registration  
**WHEN** selection state updates  
**THEN** "Send Final Confirmation (X)" button appears in action button area  
**AND** button is positioned to the left of "Export CSV" button  
**AND** button displays count of selected registrations  
**AND** button is styled with brand-pink color to distinguish from other actions

**GIVEN** admin has selected registrations with mixed statuses (confirmed + pending)  
**WHEN** button state is evaluated  
**THEN** button is disabled  
**AND** admin must deselect non-confirmed registrations to enable button

---

### US-003: Customize Email Templates with Persistence
**As an** admin  
**I want** to customize email templates (ZH/EN) and have them saved between sessions  
**So that** I don't need to re-enter template content each time

**Acceptance Criteria (EARS)**:
- **Event**: When admin clicks "Send Final Confirmation" button
- **Action**: Modal opens with email template editor
- **Response**: Modal loads templates from localStorage or uses defaults
- **State**: Admin can edit subject and body for both ZH and EN versions

**GIVEN** admin clicks "Send Final Confirmation" button  
**WHEN** modal opens  
**THEN** modal displays:
  - Event title and recipient count
  - Chinese email section: subject input + body textarea
  - English email section: subject input + body textarea
  - Help text showing available variables: {{name}}, {{eventTitle}}, {{eventDate}}, {{eventLocation}}
  - "Cancel" and "Send to X recipients" buttons

**GIVEN** admin has not customized templates before  
**WHEN** modal loads for the first time  
**THEN** templates are populated with default hardcoded content  
**AND** default templates include all variable placeholders

**GIVEN** admin has previously customized templates  
**WHEN** modal loads  
**THEN** templates are loaded from localStorage  
**AND** previous customizations are displayed

**GIVEN** admin edits template content  
**WHEN** admin changes subject or body fields  
**THEN** changes are immediately saved to localStorage  
**AND** changes persist across browser sessions

---

### US-004: Send Batch Emails with Progress Tracking
**As an** admin  
**I want** to send batch emails and see real-time progress  
**So that** I know which emails succeeded or failed

**Acceptance Criteria (EARS)**:
- **Event**: When admin clicks "Send to X recipients" button
- **Action**: System sends emails to all selected registrations
- **Response**: Modal shows sending progress, then displays results
- **State**: Only successful sends update registration status to `ready`

**GIVEN** admin clicks "Send to X recipients" button with valid templates  
**WHEN** send process starts  
**THEN** modal transitions to "sending" state  
**AND** displays loading spinner with "Sending emails... Please wait." message  
**AND** all inputs are disabled  
**AND** footer buttons are disabled

**GIVEN** emails are being sent  
**WHEN** API processes each registration  
**THEN** system:
  - Sends email with localized template (zh or en based on registration.locale)
  - Interpolates variables: {{name}}, {{eventTitle}}, {{eventDate}}, {{eventLocation}}
  - For successful send: updates registration status to `ready` + adds audit trail entry
  - For failed send: logs error but does not update registration status

**GIVEN** all emails have been processed  
**WHEN** API returns results  
**THEN** modal transitions to "results" state  
**AND** displays results summary: "Successfully sent X of Y emails"  
**AND** displays detailed results table with columns: Name, Email, Status, Error  
**AND** successful sends show green "Sent" badge  
**AND** failed sends show red "Failed" badge with error message  
**AND** footer shows only "Close" button (enabled)

**GIVEN** admin reviews results  
**WHEN** admin clicks "Close" button  
**THEN** modal closes  
**AND** registrations list refreshes to show updated statuses

---

### US-005: Prevent Duplicate Final Confirmations
**As an** admin  
**I want** the system to prevent sending final confirmation to registrations already in `ready` status  
**So that** users don't receive duplicate emails

**Acceptance Criteria (EARS)**:
- **Event**: When registration status is `ready`
- **Action**: Row checkbox is disabled
- **Response**: Cannot select `ready` registrations for batch email
- **State**: Only `confirmed` registrations can be selected

**GIVEN** registration has status `ready`  
**WHEN** admin views registration in table  
**THEN** checkbox is disabled  
**AND** status badge displays green color  
**AND** registration cannot be included in batch selection

---

## Technical Design

### Database Schema Changes

#### Migration 010: Add 'ready' Status

**File**: `lib/db/migrations/010_add_ready_status.sql`

```sql
-- Migration 010: Add 'ready' status to registrations
-- Adds the 'ready' status to represent registrations that have received final confirmation

-- Update the status check constraint to include 'ready'
ALTER TABLE public.registrations 
DROP CONSTRAINT IF EXISTS registrations_status_check;

ALTER TABLE public.registrations
ADD CONSTRAINT registrations_status_check 
CHECK (status IN ('created', 'pending', 'confirmed', 'cancelled', 'ready'));

-- Add comment explaining status flow
COMMENT ON COLUMN public.registrations.status IS 
'Registration status flow: created → pending → confirmed → ready (or cancelled at any point)';
```

**Status Flow**:
- `pending`: Awaiting payment confirmation
- `confirmed`: Payment confirmed by admin
- `ready`: Final confirmation email sent (ready to attend event)
- `cancelled`: Registration cancelled (can happen at any stage)

---

### Type Definitions

#### Update Registration Status Type

**File**: `lib/registration-store.ts`

**Changes**:
```typescript
// Line 9: Update REGISTRATION_STATUSES constant
export const REGISTRATION_STATUSES = ['pending', 'confirmed', 'cancelled', 'ready'] as const;
```

---

#### Add Final Confirmation Email Templates

**File**: `lib/email-templates.ts`

**New Function**:
```typescript
export function getFinalConfirmationEmailTemplates(): Record<EmailLocale, EmailTemplate> {
  return {
    zh: {
      subject: 'Book Digest 活動最終確認｜{{eventTitle}}',
      body: `嗨 {{name}}，

您報名的 Book Digest 活動即將舉行！

活動詳情：
• 活動：{{eventTitle}}
• 日期：{{eventDate}}
• 地點：{{eventLocation}}

請準時參加，我們期待在活動中見到您！

如有任何問題，請隨時與我們聯繫：bookdigest2020@gmail.com

Book Digest 團隊
{{siteUrl}}`,
    },
    en: {
      subject: 'Book Digest Event Final Confirmation | {{eventTitle}}',
      body: `Hi {{name}},

Your Book Digest event is coming up soon!

Event Details:
• Event: {{eventTitle}}
• Date: {{eventDate}}
• Location: {{eventLocation}}

Please arrive on time. We look forward to seeing you at the event!

If you have any questions, please feel free to contact us at bookdigest2020@gmail.com

Book Digest Team
{{siteUrl}}`,
    },
  };
}
```

**Template Variables**:
- `{{name}}` - Registration name
- `{{eventTitle}}` - Event title (localized based on registration.locale)
- `{{eventDate}}` - Formatted event date in local timezone
- `{{eventLocation}}` - Venue name and address (e.g., "Venue Name, Address")
- `{{siteUrl}}` - Site URL from environment config

---

### API Endpoints

#### POST /api/admin/send-final-confirmation

**Purpose**: Send batch final confirmation emails and update registration status to `ready`

**Auth**: Required (Bearer token)

**Request Body**:
```typescript
{
  registrationIds: string[];  // Array of registration IDs to send to
  subjectZh: string;          // Chinese email subject line
  subjectEn: string;          // English email subject line
  templateZh: string;         // Chinese email body template
  templateEn: string;         // English email body template
}
```

**Response**:
```typescript
{
  results: Array<{
    registrationId: string;
    success: boolean;
    email: string;         // Recipient email address
    name: string;          // Recipient name (for UI display)
    error?: string;        // Error message if failed
  }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}
```

**Validation Rules**:
1. All `registrationIds` must exist
2. All registrations must have status `confirmed` (reject if any are not)
3. All registrations must belong to the same event (reject if different events)
4. Both ZH and EN templates must be non-empty strings
5. Both ZH and EN subjects must be non-empty strings

**Error Responses**:
- `400 Bad Request`: Validation failed (e.g., mixed events, non-confirmed status, empty templates)
  ```json
  { "error": "All registrations must be confirmed status" }
  { "error": "All registrations must belong to the same event" }
  { "error": "Email templates cannot be empty" }
  ```
- `401 Unauthorized`: Missing or invalid Bearer token
- `500 Internal Server Error`: Email provider completely failed

**Success Response** (even with partial failures):
- `200 OK`: Returns results array with success/failure per registration

**Implementation Flow**:
```typescript
1. Validate admin authentication
2. Fetch all registrations by IDs with JOIN to events table
3. Validate all are confirmed status → return 400 if not
4. Validate all belong to same event → return 400 if not
5. Get event details (for template interpolation)
6. Initialize results array

7. For each registration:
   a. Select template based on registration.locale (zh or en)
   b. Interpolate variables in subject and body:
      - {{name}} → registration.name
      - {{eventTitle}} → event.title (or event.title_en if locale === 'en')
      - {{eventDate}} → formatEventDate(event.event_date, event.venue_location, registration.locale)
      - {{eventLocation}} → formatVenueLocation(event.venue_name, event.venue_address, registration.locale)
      - {{siteUrl}} → CLIENT_ENV.SITE_URL
   c. Send email via email service
   d. If success:
      - Update registration status to 'ready'
      - Add audit trail entry:
        {
          at: new Date().toISOString(),
          event: 'email_sent',
          actor: 'admin',
          summary: 'Final confirmation email sent',
          details: { emailType: 'final_confirmation' }
        }
      - Add to results: { registrationId, success: true, email, name }
   e. If failure:
      - Do NOT update registration status
      - Log error
      - Add to results: { registrationId, success: false, email, name, error: errorMessage }

8. Calculate summary: total, successful, failed counts
9. Return { results, summary }
```

**File**: `app/api/admin/send-final-confirmation/route.ts`

---

### Components

#### FinalConfirmationModal

**File**: `components/admin/FinalConfirmationModal.tsx` (new)

**Props**:
```typescript
interface FinalConfirmationModalProps {
  registrations: RegistrationRecord[];  // Selected confirmed registrations
  event: Event;                          // The event (all registrations must be from this event)
  onClose: () => void;                   // Callback to close modal
  onSuccess: () => void;                 // Callback to refresh registrations list
}
```

**State**:
```typescript
type ModalState = 'editing' | 'sending' | 'results';

const [modalState, setModalState] = useState<ModalState>('editing');
const [subjectZh, setSubjectZh] = useState('');
const [subjectEn, setSubjectEn] = useState('');
const [templateZh, setTemplateZh] = useState('');
const [templateEn, setTemplateEn] = useState('');
const [results, setResults] = useState<Array<{
  registrationId: string;
  email: string;
  name: string;
  success: boolean;
  error?: string;
}>>([]);
const [summary, setSummary] = useState<{
  total: number;
  successful: number;
  failed: number;
} | null>(null);
```

**LocalStorage Keys**:
```typescript
const STORAGE_KEY_SUBJECT_ZH = 'admin_final_confirmation_subject_zh';
const STORAGE_KEY_SUBJECT_EN = 'admin_final_confirmation_subject_en';
const STORAGE_KEY_TEMPLATE_ZH = 'admin_final_confirmation_template_zh';
const STORAGE_KEY_TEMPLATE_EN = 'admin_final_confirmation_template_en';
```

**Initialization**:
```typescript
useEffect(() => {
  // Load from localStorage or use defaults
  const defaults = getFinalConfirmationEmailTemplates();
  
  setSubjectZh(
    localStorage.getItem(STORAGE_KEY_SUBJECT_ZH) || defaults.zh.subject
  );
  setSubjectEn(
    localStorage.getItem(STORAGE_KEY_SUBJECT_EN) || defaults.en.subject
  );
  setTemplateZh(
    localStorage.getItem(STORAGE_KEY_TEMPLATE_ZH) || defaults.zh.body
  );
  setTemplateEn(
    localStorage.getItem(STORAGE_KEY_TEMPLATE_EN) || defaults.en.body
  );
}, []);
```

**Template Change Handlers** (with auto-save to localStorage):
```typescript
const updateSubjectZh = (value: string) => {
  setSubjectZh(value);
  localStorage.setItem(STORAGE_KEY_SUBJECT_ZH, value);
};

const updateSubjectEn = (value: string) => {
  setSubjectEn(value);
  localStorage.setItem(STORAGE_KEY_SUBJECT_EN, value);
};

const updateTemplateZh = (value: string) => {
  setTemplateZh(value);
  localStorage.setItem(STORAGE_KEY_TEMPLATE_ZH, value);
};

const updateTemplateEn = (value: string) => {
  setTemplateEn(value);
  localStorage.setItem(STORAGE_KEY_TEMPLATE_EN, value);
};
```

**Send Handler**:
```typescript
const handleSend = async () => {
  setModalState('sending');

  try {
    const response = await fetch('/api/admin/send-final-confirmation', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        registrationIds: registrations.map(r => r.id),
        subjectZh,
        subjectEn,
        templateZh,
        templateEn,
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to send emails');
    }

    // Show results - admin must manually close
    setResults(data.results);
    setSummary(data.summary);
    setModalState('results');

  } catch (error) {
    alert(error instanceof Error ? error.message : 'Failed to send emails');
    setModalState('editing'); // Back to editing on error
  }
};
```

**Modal UI States**:

1. **Editing State** (`modalState === 'editing'`):
   - Header: "Send Final Confirmation (X recipients)"
   - Event info section
   - Chinese template section (subject + body)
   - English template section (subject + body)
   - Help text with variable list
   - Footer: "Cancel" + "Send to X recipients" buttons

2. **Sending State** (`modalState === 'sending'`):
   - Header: "Send Final Confirmation (X recipients)"
   - Loading spinner
   - Message: "Sending emails... Please wait."
   - Footer: Disabled buttons

3. **Results State** (`modalState === 'results'`):
   - Header: "Send Results"
   - Summary box: "Successfully sent X of Y emails"
   - Results table: Name, Email, Status, Error columns
   - Footer: "Close" button only (enabled)

**Styling**:
- Modal: Centered overlay with max-width 800px
- Template textareas: 8 rows minimum height, monospace font
- Results table: Scrollable if many rows
- Status badges: Green for "Sent", Red for "Failed"
- Help text: Small gray text with monospace variable names

---

#### Update RegistrationsPage Component

**File**: `app/admin/registrations/page.tsx`

**New State**:
```typescript
const [selectedRegistrations, setSelectedRegistrations] = useState<Set<string>>(new Set());
const [showFinalConfirmationModal, setShowFinalConfirmationModal] = useState(false);
```

**Conditional Checkbox Column**:
Only render checkbox column when `registrationEventFilter !== 'ALL'`

**Table Header** (when event filter active):
```tsx
<thead className="bg-white/5 text-left text-white/60">
  <tr>
    {registrationEventFilter !== 'ALL' && (
      <th className="px-4 py-3 font-medium w-12">
        <input
          type="checkbox"
          checked={
            registrations.filter(r => r.status === 'confirmed').length > 0 &&
            selectedRegistrations.size === registrations.filter(r => r.status === 'confirmed').length
          }
          onChange={(e) => {
            if (e.target.checked) {
              // Select all confirmed registrations
              setSelectedRegistrations(
                new Set(registrations.filter(r => r.status === 'confirmed').map(r => r.id))
              );
            } else {
              // Deselect all
              setSelectedRegistrations(new Set());
            }
          }}
          disabled={registrations.filter(r => r.status === 'confirmed').length === 0}
          className="h-4 w-4 rounded border-white/20 bg-black/20"
        />
      </th>
    )}
    <th className="px-4 py-3 font-medium">Created</th>
    {/* ... other columns ... */}
  </tr>
</thead>
```

**Table Row** (when event filter active):
```tsx
<tbody className="divide-y divide-white/10 bg-black/10">
  {registrations.map((registration) => (
    <tr key={registration.id}>
      {registrationEventFilter !== 'ALL' && (
        <td className="px-4 py-3">
          <input
            type="checkbox"
            checked={selectedRegistrations.has(registration.id)}
            onChange={(e) => {
              const newSelected = new Set(selectedRegistrations);
              if (e.target.checked) {
                newSelected.add(registration.id);
              } else {
                newSelected.delete(registration.id);
              }
              setSelectedRegistrations(newSelected);
            }}
            disabled={registration.status !== 'confirmed'}
            className="h-4 w-4 rounded border-white/20 bg-black/20 disabled:opacity-30"
          />
        </td>
      )}
      {/* ... other columns ... */}
    </tr>
  ))}
</tbody>
```

**Action Buttons** (lines 220-232):
```tsx
<div className="flex flex-wrap gap-3">
  {/* Send Final Confirmation button - only show when event filter active and selections exist */}
  {registrationEventFilter !== 'ALL' && selectedRegistrations.size > 0 && (
    <button 
      type="button" 
      onClick={() => setShowFinalConfirmationModal(true)}
      disabled={
        registrationsLoading || 
        actionInFlight ||
        // Check all selected are confirmed
        !Array.from(selectedRegistrations).every(id => 
          registrations.find(r => r.id === id)?.status === 'confirmed'
        )
      }
      className="inline-flex min-h-11 items-center rounded-full border border-brand-pink/30 bg-brand-pink/20 px-4 py-2 text-sm font-medium text-white/90 transition hover:bg-brand-pink/30 disabled:opacity-60"
    >
      Send Final Confirmation ({selectedRegistrations.size})
    </button>
  )}
  
  <button type="button" onClick={() => void handleAction(downloadRegistrationsCsv)} /* ... */>
    Export CSV
  </button>
  
  <button type="button" onClick={() => void refreshRegistrations()} /* ... */>
    {registrationsLoading ? <Spinner /> : 'Search'}
  </button>
</div>
```

**Modal Integration**:
```tsx
{/* Final Confirmation Modal */}
{showFinalConfirmationModal && (
  <FinalConfirmationModal
    registrations={registrations.filter(r => selectedRegistrations.has(r.id))}
    event={events.find(e => e.id === registrationEventFilter)!}
    onClose={() => {
      setShowFinalConfirmationModal(false);
      setSelectedRegistrations(new Set()); // Clear selections after close
    }}
    onSuccess={() => {
      void refreshRegistrations(); // Refresh to show updated statuses
    }}
  />
)}
```

**Status Badge Styling**:
Update status badge colors to include green for `ready`:

```tsx
<span className={`rounded-full px-2.5 py-1 text-xs uppercase tracking-wide ${
  registration.status === 'confirmed' ? 'bg-blue-500/20 text-blue-300' :
  registration.status === 'ready' ? 'bg-green-500/20 text-green-300' :
  registration.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300' :
  registration.status === 'cancelled' ? 'bg-red-500/20 text-red-300' :
  'bg-white/10 text-white'
}`}>
  {registration.status}
</span>
```

---

## Testing Strategy

### Unit Tests

#### Registration Status Type Tests

**File**: `tests/lib/registration-store.test.ts` (update)

- Test `REGISTRATION_STATUSES` includes 'ready'
- Test type inference for `RegistrationRecordStatus`

#### Email Template Tests

**File**: `tests/lib/email-templates.test.ts` (new)

- Test `getFinalConfirmationEmailTemplates()` returns correct structure
- Test templates contain all required variables
- Test template interpolation with sample data

#### API Endpoint Tests

**File**: `tests/api/admin-send-final-confirmation.test.ts` (new)

**Test Cases**:
1. Successfully send emails to multiple confirmed registrations
2. Reject if any registration is not confirmed status
3. Reject if registrations belong to different events
4. Reject if templates are empty
5. Return partial success when some emails fail
6. Only update status to 'ready' for successful sends
7. Add audit trail entries for successful sends
8. Require admin authentication

**Example Test**:
```typescript
describe('POST /api/admin/send-final-confirmation', () => {
  it('sends emails and updates status for confirmed registrations', async () => {
    // Setup: Create event and 3 confirmed registrations
    const event = await createTestEvent();
    const regs = await Promise.all([
      createTestRegistration({ eventId: event.id, status: 'confirmed', locale: 'zh' }),
      createTestRegistration({ eventId: event.id, status: 'confirmed', locale: 'en' }),
      createTestRegistration({ eventId: event.id, status: 'confirmed', locale: 'zh' }),
    ]);

    const response = await fetch('/api/admin/send-final-confirmation', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        registrationIds: regs.map(r => r.id),
        subjectZh: 'Test Subject ZH',
        subjectEn: 'Test Subject EN',
        templateZh: 'Hello {{name}}, event {{eventTitle}}',
        templateEn: 'Hi {{name}}, event {{eventTitle}}',
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.summary).toEqual({
      total: 3,
      successful: 3,
      failed: 0,
    });

    // Verify status updated to 'ready'
    for (const reg of regs) {
      const updated = await fetchRegistration(reg.id);
      expect(updated.status).toBe('ready');
      expect(updated.auditTrail).toContainEqual(
        expect.objectContaining({
          event: 'email_sent',
          actor: 'admin',
          summary: 'Final confirmation email sent',
        })
      );
    }
  });

  it('rejects if registrations are not all confirmed', async () => {
    const event = await createTestEvent();
    const regs = await Promise.all([
      createTestRegistration({ eventId: event.id, status: 'confirmed' }),
      createTestRegistration({ eventId: event.id, status: 'pending' }),
    ]);

    const response = await fetch('/api/admin/send-final-confirmation', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        registrationIds: regs.map(r => r.id),
        subjectZh: 'Subject',
        subjectEn: 'Subject',
        templateZh: 'Body',
        templateEn: 'Body',
      }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('confirmed status');
  });

  it('rejects if registrations belong to different events', async () => {
    const event1 = await createTestEvent();
    const event2 = await createTestEvent();
    const regs = await Promise.all([
      createTestRegistration({ eventId: event1.id, status: 'confirmed' }),
      createTestRegistration({ eventId: event2.id, status: 'confirmed' }),
    ]);

    const response = await fetch('/api/admin/send-final-confirmation', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        registrationIds: regs.map(r => r.id),
        subjectZh: 'Subject',
        subjectEn: 'Subject',
        templateZh: 'Body',
        templateEn: 'Body',
      }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('same event');
  });
});
```

### Component Tests

#### FinalConfirmationModal Tests

**File**: `tests/components/FinalConfirmationModal.test.tsx` (new)

**Test Cases**:
1. Renders in editing state with default templates
2. Loads templates from localStorage if available
3. Saves template changes to localStorage
4. Transitions to sending state on send click
5. Transitions to results state on successful send
6. Displays results table with success/failure per registration
7. Closes and triggers onSuccess callback on close button
8. Shows error and returns to editing state on send failure

---

### E2E Tests

#### Batch Final Confirmation Flow

**File**: `tests/e2e/batch-final-confirmation.spec.ts` (new)

**Test Cases**:

1. **Happy Path: Send batch final confirmation**
   ```typescript
   test('admin can send batch final confirmation to confirmed registrations', async ({ page }) => {
     // Setup: Create event with 3 confirmed registrations
     // Navigate to admin registrations page
     // Filter by specific event
     // Verify checkboxes appear
     // Select all confirmed registrations
     // Verify "Send Final Confirmation (3)" button appears
     // Click button
     // Verify modal opens with templates
     // Modify templates
     // Click "Send to 3 recipients"
     // Wait for results state
     // Verify "Successfully sent 3 of 3 emails"
     // Click Close
     // Verify registrations now show "ready" status
   });
   ```

2. **Checkbox Behavior**
   ```typescript
   test('checkboxes only enabled for confirmed registrations', async ({ page }) => {
     // Setup: Create event with pending, confirmed, and cancelled registrations
     // Filter by event
     // Verify confirmed checkbox is enabled
     // Verify pending checkbox is disabled
     // Verify cancelled checkbox is disabled
   });
   ```

3. **Event Filter Requirement**
   ```typescript
   test('checkboxes hidden when event filter is ALL', async ({ page }) => {
     // Navigate to registrations page
     // Set filter to ALL
     // Verify no checkbox column
     // Set filter to specific event
     // Verify checkbox column appears
   });
   ```

4. **Template Persistence**
   ```typescript
   test('templates persist across modal open/close', async ({ page }) => {
     // Open modal
     // Edit templates
     // Close modal
     // Re-open modal
     // Verify templates retained
     // Refresh page
     // Open modal again
     // Verify templates still retained (localStorage)
   });
   ```

5. **Partial Failure Handling**
   ```typescript
   test('shows partial results when some emails fail', async ({ page }) => {
     // Mock API to return partial success
     // Send batch
     // Verify results show success count and failed count
     // Verify failed registrations remain "confirmed"
     // Verify successful registrations updated to "ready"
   });
   ```

6. **Button State Management**
   ```typescript
   test('send button disabled for mixed status selections', async ({ page }) => {
     // Select confirmed registration (button enabled)
     // Manually select pending registration (button disabled)
     // Deselect pending (button enabled again)
   });
   ```

---

## Implementation Plan

### Phase 1: Database Migration (0.5 day)
- Create migration file `010_add_ready_status.sql`
- Test migration on local Supabase
- Verify constraint updated correctly
- Test manual status updates to 'ready'

**Files**:
- `lib/db/migrations/010_add_ready_status.sql`

---

### Phase 2: Type Definitions and Templates (0.5 day)
- Update `REGISTRATION_STATUSES` in `lib/registration-store.ts`
- Add `getFinalConfirmationEmailTemplates()` to `lib/email-templates.ts`
- Run type check: `npx tsc --noEmit`

**Files**:
- `lib/registration-store.ts` (update)
- `lib/email-templates.ts` (update)

---

### Phase 3: API Endpoint (2 days)
- Implement `app/api/admin/send-final-confirmation/route.ts`
- Add validation logic (status check, event check)
- Implement email sending with template interpolation
- Add audit trail logging for successful sends
- Write unit tests

**Files**:
- `app/api/admin/send-final-confirmation/route.ts`
- `tests/api/admin-send-final-confirmation.test.ts`

---

### Phase 4: FinalConfirmationModal Component (2 days)
- Create modal component with 3-state state machine
- Implement localStorage integration
- Add template editor with auto-save
- Add results table with success/failure display
- Write component tests

**Files**:
- `components/admin/FinalConfirmationModal.tsx`
- `tests/components/FinalConfirmationModal.test.tsx`

---

### Phase 5: Update RegistrationsPage (1.5 days)
- Add selection state management
- Add conditional checkbox column
- Add "Send Final Confirmation" button
- Update status badge colors
- Integrate FinalConfirmationModal
- Test selection logic

**Files**:
- `app/admin/registrations/page.tsx` (update)

---

### Phase 6: E2E Testing and Documentation (2 days)
- Write E2E tests for full flow
- Test edge cases (partial failures, mixed statuses)
- Update admin documentation
- Manual testing of all flows

**Files**:
- `tests/e2e/batch-final-confirmation.spec.ts`
- `docs/admin-guide.md` (update)
- `CLAUDE.md` (update test coverage section)

---

**Total Estimate**: 8.5 days

---

## Security Considerations

- **Admin Authentication**: Endpoint requires Bearer token
- **Input Validation**: Strict validation of all inputs (registration IDs, templates)
- **Status Validation**: Prevent sending to non-confirmed registrations
- **Event Isolation**: Ensure all registrations belong to same event
- **SQL Injection**: Use parameterized queries
- **XSS Prevention**: Sanitize template content before displaying in admin UI
- **Rate Limiting**: Consider rate limiting for batch email endpoint

---

## Performance Considerations

- **Batch Size**: No hard limit, but UI selects from filtered results (typically < 100)
- **Email Sending**: Sequential sending to provide accurate progress
- **Database Updates**: Use transaction to update status only for successful sends
- **LocalStorage**: Minimal data (4 template strings), no performance impact

---

## Monitoring and Observability

**Metrics to Track**:
- Batch email success rate
- Average batch size
- Failed email count per batch
- Time to send batch (latency)

**Alerts**:
- Batch email failure rate > 10%
- Email provider errors

**Logs**:
- All batch sends logged to audit trail
- Failed sends logged with error details

---

## Rollout Plan

### Stage 1: Dark Launch (Preview Environment)
- Deploy migration to preview Supabase
- Deploy code to preview environment
- Test with real email addresses
- Verify localStorage persistence

### Stage 2: Production Deployment
- Deploy migration to production Supabase
- Deploy code to production
- Monitor first batch sends
- Collect admin feedback

---

## Open Questions

1. **Batch Size Limit**: Should we enforce a maximum batch size (e.g., 100 registrations)?
   - **Current Approach**: No hard limit, trust admin judgment

2. **Email Provider Limits**: Does Resend have rate limits we need to respect?
   - **Action Needed**: Check Resend documentation and implement throttling if needed

3. **Retry Logic**: Should failed emails be retryable from the results screen?
   - **Current Approach**: No retry in MVP. Admin can deselect successful ones and resend.

---

## Future Enhancements (Out of Scope)

- Preview email before sending
- Schedule batch send for future time
- Export batch send results to CSV
- Email delivery status tracking (open/click rates)
- Retry failed emails from results screen
- Template library with multiple saved templates

---

## Traceability

- **Spec ID**: FEATURE-003
- **Related Features**: FEATURE-001 (Email Infrastructure)
- **Related Commits**: Tag with `feat(FEATURE-003):`
- **Related Tests**: All test files tagged with `// Related to FEATURE-003`

---

## Approval

**Pending Review**
