import { NextRequest, NextResponse } from 'next/server';
import { runWithRequestTrace } from '@/lib/observability';
import { isAuthorizedAdminRequest } from '@/lib/admin-auth';
import { getEmailHistory, type EmailHistoryFilters } from '@/lib/email-audit';

export const dynamic = 'force-dynamic';

// GET /api/admin/email-history
export async function GET(req: NextRequest) {
  return runWithRequestTrace(req, 'admin.email-history.get', async () => {
    // Check admin authentication
    if (!(await isAuthorizedAdminRequest(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      // Parse query parameters
      const { searchParams } = new URL(req.url);

      const limit = Math.min(
        Number.parseInt(searchParams.get('limit') || '50', 10),
        200
      );

      const offset = Math.max(
        Number.parseInt(searchParams.get('offset') || '0', 10),
        0
      );

      const type = searchParams.get('type') as EmailHistoryFilters['type'];

      // Validate type if provided
      if (type && !['reservation_confirmation', 'payment_confirmation', 'test'].includes(type)) {
        return NextResponse.json({
          error: 'Invalid type parameter. Must be one of: reservation_confirmation, payment_confirmation, test',
        }, { status: 400 });
      }

      // Fetch email history
      const filters: EmailHistoryFilters = {
        limit,
        offset,
        ...(type && { type }),
      };

      const result = await getEmailHistory(filters);

      return NextResponse.json({
        ok: true,
        emails: result.emails,
        total: result.total,
        limit,
        offset,
      });
    } catch (error) {
      console.error('Error fetching email history:', error);
      return NextResponse.json({
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, { status: 500 });
    }
  });
}
