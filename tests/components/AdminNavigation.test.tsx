import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminNavigation from '@/components/admin/AdminNavigation';

// Mock Next.js navigation hooks
const mockPush = vi.fn();
const mockPathname = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('AdminNavigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname.mockReturnValue('/admin/books');
    mockPush.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it('should render all navigation tabs', () => {
    render(<AdminNavigation />);

    expect(screen.getByText('Books')).toBeInTheDocument();
    expect(screen.getByText('Events')).toBeInTheDocument();
    expect(screen.getByText('Emails')).toBeInTheDocument();
    expect(screen.getByText('Registrations')).toBeInTheDocument();
    expect(screen.getByText('Assets')).toBeInTheDocument();
    expect(screen.getByText('Logout')).toBeInTheDocument();
  });

  it('should highlight the active tab based on current pathname', () => {
    mockPathname.mockReturnValue('/admin/events');
    const { container } = render(<AdminNavigation />);

    const eventsLinks = container.querySelectorAll('a[href="/admin/events"]');
    const eventsTab = eventsLinks[0];
    expect(eventsTab).toHaveClass('bg-brand-pink', 'text-brand-navy');
  });

  it('should call router.push when tab is clicked', async () => {
    const user = userEvent.setup();
    const { container } = render(<AdminNavigation />);

    const eventsLink = container.querySelector('a[href="/admin/events"]');
    await user.click(eventsLink!);

    // Router push should be called with the correct path
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/admin/events');
    });
  });

  it('should update active tab when pathname changes', async () => {
    const user = userEvent.setup();
    const { container, rerender } = render(<AdminNavigation />);

    const eventsLink = container.querySelector('a[href="/admin/events"]');
    await user.click(eventsLink!);

    // Simulate navigation complete by updating pathname
    mockPathname.mockReturnValue('/admin/events');
    rerender(<AdminNavigation />);

    // Tab should be active
    const updatedEventsLink = container.querySelector('a[href="/admin/events"]');
    expect(updatedEventsLink).toHaveClass('bg-brand-pink', 'text-brand-navy');
  });

  it('should handle logout button click', async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
      } as Response)
    );

    // Mock window.location.href setter
    delete (window as any).location;
    window.location = { href: '' } as any;

    const { container } = render(<AdminNavigation />);

    const logoutButton = container.querySelector('button[type="button"]') as HTMLButtonElement;
    await user.click(logoutButton);

    // Should call logout API
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/session', { method: 'DELETE' });
    });
  });

  it('should have proper link structure', () => {
    const { container } = render(<AdminNavigation />);

    // All tabs should be links
    const links = container.querySelectorAll('a');
    expect(links.length).toBe(5); // 5 navigation tabs (venues removed)

    // Verify href attributes
    expect(container.querySelector('a[href="/admin/books"]')).toBeInTheDocument();
    expect(container.querySelector('a[href="/admin/events"]')).toBeInTheDocument();
    expect(container.querySelector('a[href="/admin/emails"]')).toBeInTheDocument();
    expect(container.querySelector('a[href="/admin/registrations"]')).toBeInTheDocument();
    expect(container.querySelector('a[href="/admin/assets"]')).toBeInTheDocument();
  });
});

