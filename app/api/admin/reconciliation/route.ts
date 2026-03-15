import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedAdminRequest } from '@/lib/admin-auth';
import { buildNotionReconciliationReport } from '@/lib/notion-reconciliation';
import { logServerError, runWithRequestTrace } from '@/lib/observability';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return runWithRequestTrace(request, 'admin.reconciliation', async () => {
    if (!(await isAuthorizedAdminRequest(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rawLimit = request.nextUrl.searchParams.get('limit');
    const limit = rawLimit && /^\d+$/.test(rawLimit) ? Math.max(1, Math.min(1000, Number(rawLimit))) : 500;

    try {
      const report = await buildNotionReconciliationReport(limit);
      return NextResponse.json(report, { status: 200 });
    } catch (error) {
      await logServerError('admin.reconciliation.load_failed', error, { limit });
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load reconciliation report.' }, { status: 500 });
    }
  });
}