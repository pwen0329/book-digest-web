import { NextRequest, NextResponse } from 'next/server';
import {
  getIntroTemplateByName,
  updateIntroTemplate,
  deleteIntroTemplate,
} from '@/lib/signup-intro-templates';
import { isAuthorizedAdminRequest } from '@/lib/admin-auth';

type RouteContext = {
  params: { name: string };
};

// GET /api/admin/intro-templates/[name] - Get specific template
export async function GET(request: NextRequest, { params }: RouteContext) {
  if (!(await isAuthorizedAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const template = await getIntroTemplateByName(params.name);

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(template);
  } catch (error) {
    console.error('Failed to fetch intro template:', error);
    return NextResponse.json(
      { error: 'Failed to fetch intro template' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/intro-templates/[name] - Update template
export async function PUT(request: NextRequest, { params }: RouteContext) {
  if (!(await isAuthorizedAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Build updates object
    const updates: {
      content?: string;
      contentEn?: string;
      isFree?: boolean;
    } = {};

    if (body.content !== undefined) {
      if (typeof body.content !== 'string') {
        return NextResponse.json(
          { error: 'Content must be a string' },
          { status: 400 }
        );
      }
      updates.content = body.content;
    }

    if (body.contentEn !== undefined) {
      if (typeof body.contentEn !== 'string') {
        return NextResponse.json(
          { error: 'ContentEn must be a string' },
          { status: 400 }
        );
      }
      updates.contentEn = body.contentEn;
    }

    if (body.isFree !== undefined) {
      if (typeof body.isFree !== 'boolean') {
        return NextResponse.json(
          { error: 'isFree must be a boolean' },
          { status: 400 }
        );
      }
      updates.isFree = body.isFree;
    }

    const template = await updateIntroTemplate(params.name, updates);

    return NextResponse.json(template);
  } catch (error) {
    console.error('Failed to update intro template:', error);

    if (error instanceof Error) {
      // Handle validation errors
      if (error.message.includes('validation failed')) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }

      // Handle not found
      if (error.message.includes('not found')) {
        return NextResponse.json(
          { error: error.message },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to update intro template' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/intro-templates/[name] - Delete template
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  if (!(await isAuthorizedAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await deleteIntroTemplate(params.name);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete intro template:', error);

    if (error instanceof Error && error.message.includes('currently used by')) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 } // Conflict
      );
    }

    return NextResponse.json(
      { error: 'Failed to delete intro template' },
      { status: 500 }
    );
  }
}
