import { NextRequest, NextResponse } from 'next/server';
import { getAllIntroTemplates, createIntroTemplate } from '@/lib/signup-intro-templates';
import { isAuthorizedAdminRequest } from '@/lib/admin-auth';

// GET /api/admin/intro-templates - List all templates
export async function GET(request: NextRequest) {
  if (!(await isAuthorizedAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const templates = await getAllIntroTemplates();
    return NextResponse.json(templates);
  } catch (error) {
    console.error('Failed to fetch intro templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch intro templates' },
      { status: 500 }
    );
  }
}

// POST /api/admin/intro-templates - Create new template
export async function POST(request: NextRequest) {
  if (!(await isAuthorizedAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Validate required fields
    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json(
        { error: 'Template name is required' },
        { status: 400 }
      );
    }

    if (!body.content || typeof body.content !== 'string') {
      return NextResponse.json(
        { error: 'Chinese content is required' },
        { status: 400 }
      );
    }

    if (!body.contentEn || typeof body.contentEn !== 'string') {
      return NextResponse.json(
        { error: 'English content is required' },
        { status: 400 }
      );
    }

    if (typeof body.isFree !== 'boolean') {
      return NextResponse.json(
        { error: 'isFree field is required' },
        { status: 400 }
      );
    }

    const template = await createIntroTemplate({
      name: body.name.trim(),
      content: body.content,
      contentEn: body.contentEn,
      isFree: body.isFree,
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error('Failed to create intro template:', error);

    // Return validation errors with 400
    if (error instanceof Error && error.message.includes('validation failed')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create intro template' },
      { status: 500 }
    );
  }
}
