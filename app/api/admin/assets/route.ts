import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedAdminRequest } from '@/lib/admin-auth';
import { buildManagedAssetReport, pruneOrphanedManagedAssets } from '@/lib/admin-asset-manager';
import { logServerError, runWithRequestTrace } from '@/lib/observability';

export const dynamic = 'force-dynamic';

function getGracePeriodHours(request: NextRequest): number {
  const raw = request.nextUrl.searchParams.get('gracePeriodHours');
  if (!raw || !/^\d+$/.test(raw)) {
    return 168;
  }

  return Math.max(1, Math.min(24 * 90, Number(raw)));
}

export async function GET(request: NextRequest) {
  return runWithRequestTrace(request, 'admin.assets.get', async () => {
    if (!(await isAuthorizedAdminRequest(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      const report = await buildManagedAssetReport(getGracePeriodHours(request));
      return NextResponse.json(report, { status: 200 });
    } catch (error) {
      await logServerError('admin.assets.report_failed', error);
      return NextResponse.json({ error: 'Unable to build asset report.' }, { status: 500 });
    }
  });
}

export async function DELETE(request: NextRequest) {
  return runWithRequestTrace(request, 'admin.assets.delete', async () => {
    if (!(await isAuthorizedAdminRequest(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      const result = await pruneOrphanedManagedAssets(getGracePeriodHours(request));
      return NextResponse.json({ ok: true, ...result }, { status: 200 });
    } catch (error) {
      await logServerError('admin.assets.prune_failed', error);
      return NextResponse.json({ error: 'Unable to prune orphaned assets.' }, { status: 500 });
    }
  });
}