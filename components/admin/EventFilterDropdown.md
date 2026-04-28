# EventFilterDropdown Component

## Type Safety

The `EventFilterDropdown` component uses strict TypeScript types to prevent runtime errors from missing event data fields.

### Required Event Fields

The component requires these fields from each event:
- `id: number` - Unique event identifier
- `title: string` - Chinese event title
- `titleEn?: string | null` - English event title (optional)
- `eventDate: string` - ISO date string for the event

### Type: EventFilterItem

```typescript
export type EventFilterItem = Pick<Event, 'id' | 'title' | 'eventDate'> & {
  titleEn?: string | null;
};
```

This type is exported so you can use it in your component props for strict type checking.

## Usage Examples

### Example 1: Using with full Event objects (Recommended)

If you already have full `Event[]` objects, you can pass them directly:

```typescript
import EventFilterDropdown from '@/components/admin/EventFilterDropdown';
import type { Event } from '@/types/event';

function MyComponent() {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedId, setSelectedId] = useState<number | 'ALL' | null>('ALL');
  
  // ✅ This works - Event type includes all required fields
  return (
    <EventFilterDropdown
      events={events}
      value={selectedId}
      onChange={setSelectedId}
    />
  );
}
```

### Example 2: Using EventFilterItem type in props

For components that only need event filter data:

```typescript
import EventFilterDropdown, { type EventFilterItem } from '@/components/admin/EventFilterDropdown';

type MyComponentProps = {
  events: readonly EventFilterItem[];
};

function MyComponent({ events }: MyComponentProps) {
  // ✅ Type-safe: consumers must provide correct fields
  return (
    <EventFilterDropdown
      events={events}
      value="ALL"
      onChange={() => {}}
    />
  );
}
```

### Example 3: Using the helper function

For explicit data preparation:

```typescript
import EventFilterDropdown, { prepareEventsForFilter } from '@/components/admin/EventFilterDropdown';

async function MyPage() {
  const allEvents = await getAllEvents();
  
  // ✅ Explicit: clearly shows which fields are being used
  const filterEvents = prepareEventsForFilter(allEvents);
  
  return <EventFilterDropdown events={filterEvents} ... />;
}
```

## Compile-Time Safety

### ✅ Valid - All required fields present

```typescript
const events: EventFilterItem[] = [
  {
    id: 1,
    title: '活動名稱',
    titleEn: 'Event Name',
    eventDate: '2026-06-15T10:00:00Z',
  }
];

<EventFilterDropdown events={events} ... />
```

### ❌ Invalid - Missing eventDate (Compile error)

```typescript
const events = [
  {
    id: 1,
    title: '活動名稱',
    titleEn: 'Event Name',
    // ❌ ERROR: Property 'eventDate' is missing
  }
];

<EventFilterDropdown events={events} ... />
// TypeScript error: Type '{ id: number; title: string; titleEn: string; }' 
// is not assignable to type 'EventFilterItem'
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `events` | `readonly EventFilterItem[]` | required | Array of events with id, title, titleEn, eventDate |
| `value` | `number \| 'ALL' \| null` | required | Current selection |
| `onChange` | `(value) => void` | required | Selection change handler |
| `disabled` | `boolean` | `false` | Disable the dropdown |
| `className` | `string` | auto | Custom CSS classes |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Size variant |
| `showAllOption` | `boolean` | `true` | Show "All events" option |
| `allOptionLabel` | `string` | `'All events'` | Custom "all" label |
| `locale` | `'zh' \| 'en'` | `'zh'` | Display locale |
| `showCompletedStatus` | `boolean` | `true` | Show "(complete)" for past events |

## Features

1. **Automatic Sorting**: Events are sorted by date (most recent first)
2. **Locale Support**: Displays Chinese or English titles and date formats
3. **Completion Status**: Shows "(complete)" for past events
4. **Flexible Value Types**: Supports numeric IDs, 'ALL', or null
5. **Size Variants**: sm, md, lg for different contexts
6. **Type Safety**: Compile-time checks prevent missing data

## Used In

- `/admin/registrations` - Filter registrations by event
- `/admin/emails` - Filter email history and select test event
- Add more pages as needed...
