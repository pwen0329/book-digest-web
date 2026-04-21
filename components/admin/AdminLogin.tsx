'use client';

import { useEffect, useState } from 'react';

type AdminLoginProps = {
  configured: boolean;
};

export default function AdminLogin({ configured }: AdminLoginProps) {
  const [hydrated, setHydrated] = useState(false);
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setHydrated(true);
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configured) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: 'Unable to sign in.' }));
        setError(payload.error || 'Unable to sign in.');
        return;
      }

      window.location.href = '/admin';
    } catch {
      setError('Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section data-ready={hydrated ? 'true' : 'false'} className="min-h-screen bg-brand-navy px-6 py-16 text-white">
      <div className="mx-auto max-w-xl rounded-[32px] border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur">
        <p className="font-outfit text-xs uppercase tracking-[0.35em] text-brand-pink">Book Digest Admin</p>
        <h1 className="mt-4 text-3xl font-bold font-outfit">Control public content, posters, and signup limits.</h1>
        <p className="mt-3 text-white/75">
          {configured
            ? 'Sign in with the admin password to edit books, monthly event posters, and registration capacity windows.'
            : 'Admin access is not configured. Set ADMIN_PASSWORD and ADMIN_SESSION_SECRET before using this dashboard.'}
        </p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-white/80">Admin password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-2xl border border-white/15 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-brand-pink focus:ring-2 focus:ring-brand-pink/40"
              disabled={!configured || submitting || !hydrated}
            />
          </label>

          {error ? <p className="text-sm text-red-300">{error}</p> : null}

          <button
            type="submit"
            disabled={!configured || submitting || !password || !hydrated}
            className="inline-flex min-h-11 items-center rounded-full bg-brand-pink px-6 py-3 font-semibold text-brand-navy transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </section>
  );
}