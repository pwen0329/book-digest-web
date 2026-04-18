import { getAllVenues } from '@/lib/venues';
import VenueManager from '@/components/admin/VenueManager';

export default async function VenuesPage() {
  const venues = await getAllVenues();
  return <VenueManager initialVenues={venues} />;
}
