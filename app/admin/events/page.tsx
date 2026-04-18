import { getAllEvents } from '@/lib/events';
import { getAllVenues } from '@/lib/venues';
import { getAllBooksFromDB } from '@/lib/books-db';
import EventManager from '@/components/admin/EventManager';

export default async function EventsPage() {
  const [events, venues, books] = await Promise.all([
    getAllEvents({ includeVenue: true, includeBook: true }),
    getAllVenues(),
    getAllBooksFromDB(),
  ]);

  return <EventManager initialEvents={events} initialVenues={venues} initialBooks={books} />;
}
