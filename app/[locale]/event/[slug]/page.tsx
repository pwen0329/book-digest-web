import { redirect } from 'next/navigation';
import { getEventBySlug } from '@/lib/events';
import { locales } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale, slug: 'placeholder' }));
}

export default async function EventDetailPage({
  params
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params;

  // Fetch the event
  const event = await getEventBySlug(slug);

  // If event doesn't exist or is not published, redirect to events page
  if (!event || !event.isPublished) {
    redirect(`/${locale}/events`);
  }

  // Redirect to events page with query params to pre-select tabs
  const venueLocation = event.venueLocation;
  redirect(`/${locale}/events?venue=${venueLocation}&event=${event.id}`);
}
