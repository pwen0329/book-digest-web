import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import IntroTemplateManager from '@/components/admin/IntroTemplateManager';
import type { SignupIntroTemplate } from '@/types/signup-intro';

// Mock global fetch
global.fetch = vi.fn();

const mockTemplates: SignupIntroTemplate[] = [
  {
    name: 'default_paid',
    content: '付款金額：{{payment_amount}} {{payment_currency}}',
    contentEn: 'Payment: {{payment_amount}} {{payment_currency}}',
    isFree: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    name: 'free_event',
    content: '免費活動',
    contentEn: 'Free event',
    isFree: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

describe('IntroTemplateManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal when open', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockTemplates,
    });

    render(
      <IntroTemplateManager
        open={true}
        onClose={vi.fn()}
        onTemplatesChanged={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Manage Signup Intro Templates')).toBeInTheDocument();
    });
  });

  it('fetches and displays templates', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockTemplates,
    });

    render(
      <IntroTemplateManager
        open={true}
        onClose={vi.fn()}
        onTemplatesChanged={vi.fn()}
      />
    );

    // Wait for templates to load
    await waitFor(() => {
      expect(screen.getByText('default_paid')).toBeInTheDocument();
      expect(screen.getByText('free_event')).toBeInTheDocument();
    });
  });

  it('shows create button in list view', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockTemplates,
    });

    render(
      <IntroTemplateManager
        open={true}
        onClose={vi.fn()}
        onTemplatesChanged={vi.fn()}
      />
    );

    await waitFor(() => {
      const buttons = screen.getAllByText('+ Create New Template');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  it('shows empty state when no templates', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    render(
      <IntroTemplateManager
        open={true}
        onClose={vi.fn()}
        onTemplatesChanged={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/No templates found/i)).toBeInTheDocument();
    });
  });

  it('does not render when closed', () => {
    const { container } = render(
      <IntroTemplateManager
        open={false}
        onClose={vi.fn()}
        onTemplatesChanged={vi.fn()}
      />
    );

    expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
  });
});
