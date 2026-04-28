import { getAllEvents } from '@/lib/events';
import { getAllBooksFromDB } from '@/lib/books-db';
import EventManager from '@/components/admin/EventManager';

export default async function EventsPage() {
  const [events, books] = await Promise.all([
    getAllEvents({ includeBook: true }),
    getAllBooksFromDB(),
  ]);

  return <EventManager initialEvents={events} initialBooks={books} />;
}
