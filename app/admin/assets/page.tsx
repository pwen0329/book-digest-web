'use client';

import { useState, useEffect, useCallback } from 'react';

type AssetReportResponse = {
  generatedAt: string;
  gracePeriodHours: number;
  referencedCount: number;
  storedCount: number;
  orphanedCount: number;
  missingReferencedCount: number;
  orphaned: Array<{ url: string; scope: 'books' | 'events'; fileName: string; storage: 'local' | 'supabase'; modifiedAt?: string }>;
  missingReferenced: Array<{ url: string; scope: 'books' | 'events'; fileName: string }>;
};

export default function AssetsPage() {
  const [assetReport, setAssetReport] = useState<AssetReportResponse | null>(null);
  const [assetReportLoading, setAssetReportLoading] = useState(false);
  const [assetGracePeriodHours, setAssetGracePeriodHours] = useState('168');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionInFlight, setActionInFlight] = useState(false);

  const refreshAssetReport = useCallback(async () => {
    setAssetReportLoading(true);
    try {
      const response = await fetch(`/api/admin/assets?gracePeriodHours=${encodeURIComponent(assetGracePeriodHours)}`, {
        cache: 'no-store',
        credentials: 'include',
      });
      const payload = await response.json().catch(() => null) as AssetReportResponse | null;
      if (!response.ok || !payload) {
        throw new Error(payload && 'error' in payload ? String((payload as { error?: unknown }).error) : 'Unable to load asset report.');
      }

      setAssetReport(payload);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Unable to load asset report.');
    } finally {
      setAssetReportLoading(false);
    }
  }, [assetGracePeriodHours]);

  useEffect(() => {
    void refreshAssetReport();
  }, [refreshAssetReport]);

  async function pruneOrphanedAssets() {
    const response = await fetch(`/api/admin/assets?gracePeriodHours=${encodeURIComponent(assetGracePeriodHours)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    const payload = await response.json().catch(() => ({ error: 'Unable to prune orphaned assets.' }));
    if (!response.ok) {
      throw new Error(payload.error || 'Unable to prune orphaned assets.');
    }

    setMessage(`Deleted ${Array.isArray(payload.deleted) ? payload.deleted.length : 0} orphaned assets older than ${assetGracePeriodHours} hours.`);
    await refreshAssetReport();
  }

  async function handleAction(action: () => Promise<void>) {
    if (actionInFlight) {
      return;
    }

    setActionInFlight(true);
    setError(null);
    setMessage(null);
    try {
      await action();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unexpected error.');
    } finally {
      setActionInFlight(false);
    }
  }

  return (
    <>
      {message ? <div className="rounded-[28px] border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">{message}</div> : null}
      {error ? <div className="rounded-[28px] border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">{error}</div> : null}

      <div aria-label="Assets viewer" className="rounded-[28px] border border-white/10 bg-white/10 p-6">
        <div className="flex flex-col gap-4 rounded-[24px] border border-white/10 bg-black/10 p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold font-outfit">Admin asset scan and cleanup</h2>
              <p className="mt-2 max-w-3xl text-sm text-white/70">
                The asset manager compares referenced admin images against the actual storage bucket or local upload directory, then prunes only orphaned files older than the configured grace period.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => void refreshAssetReport()} disabled={assetReportLoading} className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white/85 transition hover:bg-white/10 disabled:opacity-60">
                {assetReportLoading ? 'Scanning…' : 'Scan assets'}
              </button>
              <button type="button" onClick={() => void handleAction(pruneOrphanedAssets)} disabled={assetReportLoading || actionInFlight} className="inline-flex min-h-11 items-center rounded-full border border-rose-400/40 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-100 transition hover:bg-rose-500/20 disabled:opacity-60">
                Prune old orphans
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
            <label className="block">
              <span className="mb-2 block text-sm text-white/70">Grace period hours</span>
              <input value={assetGracePeriodHours} onChange={(event) => setAssetGracePeriodHours(event.target.value.replace(/[^0-9]/g, '') || '168')} className="w-full rounded-2xl bg-black/20 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-pink/40" />
            </label>
            <div className="rounded-2xl border border-white/10 bg-brand-navy/50 p-4 text-sm text-white/70">
              Recommended policy: keep a 7-day grace period so uploads that were processed but not yet referenced by a saved document do not get deleted by the cleanup pass.
            </div>
          </div>

          {assetReport ? (
            <>
              <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-5">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-sm text-white/55">Referenced</p><p className="mt-1 text-2xl font-semibold">{assetReport.referencedCount}</p></div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-sm text-white/55">Stored</p><p className="mt-1 text-2xl font-semibold">{assetReport.storedCount}</p></div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-sm text-white/55">Orphaned</p><p className="mt-1 text-2xl font-semibold">{assetReport.orphanedCount}</p></div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-sm text-white/55">Missing referenced</p><p className="mt-1 text-2xl font-semibold">{assetReport.missingReferencedCount}</p></div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-sm text-white/55">Generated</p><p className="mt-1 text-sm font-semibold">{new Date(assetReport.generatedAt).toLocaleString()}</p></div>
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                  <h3 className="text-lg font-semibold font-outfit">Orphaned assets</h3>
                  <div className="mt-4 space-y-3">
                    {assetReport.orphaned.map((asset) => (
                      <div key={asset.url} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/75">
                        <p className="font-mono text-white">{asset.fileName}</p>
                        <p className="mt-2">{asset.scope} · {asset.storage}</p>
                        <p className="mt-2 break-all">{asset.url}</p>
                        <p className="mt-2">Modified: {asset.modifiedAt ? new Date(asset.modifiedAt).toLocaleString() : 'unknown'}</p>
                      </div>
                    ))}
                    {!assetReport.orphaned.length ? <p className="text-sm text-white/60">No orphaned assets detected.</p> : null}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                  <h3 className="text-lg font-semibold font-outfit">Referenced but missing in storage</h3>
                  <div className="mt-4 space-y-3">
                    {assetReport.missingReferenced.map((asset) => (
                      <div key={asset.url} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/75">
                        <p className="font-mono text-white">{asset.fileName}</p>
                        <p className="mt-2">{asset.scope}</p>
                        <p className="mt-2 break-all">{asset.url}</p>
                      </div>
                    ))}
                    {!assetReport.missingReferenced.length ? <p className="text-sm text-white/60">No missing referenced assets detected.</p> : null}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-white/60">No asset report loaded yet.</p>
          )}
        </div>
      </div>
    </>
  );
}
