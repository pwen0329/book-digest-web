import { locales, setRequestLocale } from '@/lib/i18n';
import SignupClient from './client';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function SignupPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SignupClient />;
}
