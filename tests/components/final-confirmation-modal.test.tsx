import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import FinalConfirmationModal from '@/components/admin/FinalConfirmationModal';
import type { RegistrationRecord } from '@/lib/registration-store';
import type { Event } from '@/types/event';

describe('FinalConfirmationModal', () => {
  const mockRegistrations: RegistrationRecord[] = [
    {
      id: 'reg-1',
      eventId: 1,
      locale: 'zh',
      name: 'Test User 1',
      age: 25,
      profession: 'Engineer',
      email: 'user1@test.com',
      referral: 'Friend',
      timestamp: '2026-04-01T10:00:00Z',
      status: 'confirmed',
      createdAt: '2026-04-01T10:00:00Z',
      updatedAt: '2026-04-01T10:00:00Z',
    },
    {
      id: 'reg-2',
      eventId: 1,
      locale: 'en',
      name: 'Test User 2',
      age: 30,
      profession: 'Designer',
      email: 'user2@test.com',
      referral: 'Instagram',
      timestamp: '2026-04-01T11:00:00Z',
      status: 'confirmed',
      createdAt: '2026-04-01T11:00:00Z',
      updatedAt: '2026-04-01T11:00:00Z',
    },
  ];

  const mockEvent: Event = {
    id: 1,
    slug: 'test-event',
    title: 'Test Event',
    titleEn: 'Test Event EN',
    eventDate: '2026-05-01T14:00:00Z',
    registrationOpensAt: '2026-04-01T00:00:00Z',
    registrationClosesAt: '2026-04-30T23:59:59Z',
    venueLocation: 'TW',
    venueName: 'Test Venue',
    venueAddress: '123 Test St',
    venueCapacity: 50,
    eventTypeCode: 'MANDARIN_BOOK_CLUB',
    registrationStatus: 'open',
    bookId: 1,
    isPublished: true,
    paymentAmount: 0,
    paymentCurrency: 'TWD',
    introTemplateName: 'default_paid',
    createdAt: '2026-04-01T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
  };

  const defaultProps = {
    registrations: mockRegistrations,
    event: mockEvent,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders in editing state with default templates', () => {
    render(<FinalConfirmationModal {...defaultProps} />);

    expect(screen.getByText(/Send Final Confirmation \(2 recipients\)/)).toBeInTheDocument();
    expect(screen.getByText('Test Event')).toBeInTheDocument();

    // Check email list is displayed (sorted, comma-separated)
    expect(screen.getByText('user1@test.com, user2@test.com')).toBeInTheDocument();

    // Check template sections exist
    expect(screen.getByText('Chinese Email Template')).toBeInTheDocument();
    expect(screen.getByText('English Email Template')).toBeInTheDocument();

    // Check input fields by placeholder/type
    const inputs = screen.getAllByRole('textbox');
    expect(inputs.length).toBeGreaterThan(0);

    // Check buttons
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Send to 2 recipients')).toBeInTheDocument();
  });

  it('disables send button when templates are empty', async () => {
    render(<FinalConfirmationModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getAllByRole('textbox').length).toBeGreaterThan(0);
    });

    // Clear all templates - this will save empty strings to sessionStorage
    const allInputs = screen.getAllByRole('textbox');
    allInputs.forEach(input => {
      fireEvent.change(input, { target: { value: '' } });
    });

    await waitFor(() => {
      const sendButtons = screen.getAllByText('Send to 2 recipients');
      expect(sendButtons[0]).toBeDisabled();
    });
  });

  it('calls onClose when cancel button is clicked', () => {
    render(<FinalConfirmationModal {...defaultProps} />);

    const cancelButtons = screen.getAllByText('Cancel');
    fireEvent.click(cancelButtons[0]);

    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('shows loading state while sending emails', async () => {
    vi.mocked(global.fetch).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<FinalConfirmationModal {...defaultProps} />);

    // Wait for send button to be enabled (templates loaded with defaults)
    const sendButtons = await screen.findAllByText('Send to 2 recipients');
    await waitFor(() => expect(sendButtons[0]).toBeEnabled());

    fireEvent.click(sendButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Sending emails... Please wait.')).toBeInTheDocument();
    });
  });

  it('sends API request with correct payload', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          { registrationId: 'reg-1', success: true, email: 'user1@test.com', name: 'Test User 1' },
          { registrationId: 'reg-2', success: true, email: 'user2@test.com', name: 'Test User 2' },
        ],
        summary: { total: 2, successful: 2, failed: 0 },
      }),
    });
    global.fetch = mockFetch;

    render(<FinalConfirmationModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getAllByRole('textbox').length).toBeGreaterThan(0);
    });

    // Set custom templates
    const allInputs = screen.getAllByRole('textbox');
    const subjectInputs = allInputs.filter(el => (el as HTMLInputElement).type === 'text');
    const textareas = allInputs.filter(el => (el as HTMLElement).tagName === 'TEXTAREA');

    fireEvent.change(subjectInputs[0], { target: { value: 'ZH Subject' } });
    fireEvent.change(subjectInputs[1], { target: { value: 'EN Subject' } });
    fireEvent.change(textareas[0], { target: { value: 'ZH Body' } });
    fireEvent.change(textareas[1], { target: { value: 'EN Body' } });

    const sendButtons = screen.getAllByText('Send to 2 recipients');
    fireEvent.click(sendButtons[0]);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/admin/send-final-confirmation',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            registrationIds: ['reg-1', 'reg-2'],
            subjectZh: 'ZH Subject',
            subjectEn: 'EN Subject',
            templateZh: 'ZH Body',
            templateEn: 'EN Body',
          }),
        })
      );
    });
  });

  it('shows success results after sending', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          { registrationId: 'reg-1', success: true, email: 'user1@test.com', name: 'Test User 1' },
          { registrationId: 'reg-2', success: true, email: 'user2@test.com', name: 'Test User 2' },
        ],
        summary: { total: 2, successful: 2, failed: 0 },
      }),
    } as Response);

    render(<FinalConfirmationModal {...defaultProps} />);

    // Wait for send button to be enabled
    const sendButtons = await screen.findAllByText('Send to 2 recipients');
    await waitFor(() => expect(sendButtons[0]).toBeEnabled());

    fireEvent.click(sendButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Send Results')).toBeInTheDocument();
      expect(screen.getAllByText((content, element) => {
        return element?.textContent === 'Successfully sent 2 of 2 emails';
      })[0]).toBeInTheDocument();
      expect(screen.getByText('Test User 1')).toBeInTheDocument();
      expect(screen.getByText('Test User 2')).toBeInTheDocument();
      expect(screen.getAllByText('Sent')).toHaveLength(2);
    });
  });

  it('shows partial failure results', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          { registrationId: 'reg-1', success: true, email: 'user1@test.com', name: 'Test User 1' },
          {
            registrationId: 'reg-2',
            success: false,
            email: 'user2@test.com',
            name: 'Test User 2',
            error: 'Invalid email address',
          },
        ],
        summary: { total: 2, successful: 1, failed: 1 },
      }),
    } as Response);

    render(<FinalConfirmationModal {...defaultProps} />);

    // Wait for send button to be enabled
    const sendButtons = await screen.findAllByText('Send to 2 recipients');
    await waitFor(() => expect(sendButtons[0]).toBeEnabled());

    fireEvent.click(sendButtons[0]);

    await waitFor(() => {
      expect(screen.getAllByText((content, element) => {
        return element?.textContent === 'Successfully sent 1 of 2 emails';
      })[0]).toBeInTheDocument();
      expect(screen.getByText('1 email(s) failed to send')).toBeInTheDocument();
      expect(screen.getByText('Sent')).toBeInTheDocument();
      expect(screen.getByText('Failed')).toBeInTheDocument();
      expect(screen.getByText('Invalid email address')).toBeInTheDocument();
    });
  });

  it('calls onSuccess when closing from results state', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          { registrationId: 'reg-1', success: true, email: 'user1@test.com', name: 'Test User 1' },
        ],
        summary: { total: 1, successful: 1, failed: 0 },
      }),
    } as Response);

    render(<FinalConfirmationModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getAllByRole('textbox').length).toBeGreaterThan(0);
    });

    const sendButtons = screen.getAllByText('Send to 2 recipients');
    fireEvent.click(sendButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Send Results')).toBeInTheDocument();
    });

    const closeButtons = screen.getAllByText('Close');
    fireEvent.click(closeButtons[0]);

    expect(defaultProps.onSuccess).toHaveBeenCalledTimes(1);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('shows error alert and returns to editing on API error', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Server error' }),
    } as Response);

    render(<FinalConfirmationModal {...defaultProps} />);

    // Wait for send button to be enabled
    const sendButtons = await screen.findAllByText('Send to 2 recipients');
    await waitFor(() => expect(sendButtons[0]).toBeEnabled());

    fireEvent.click(sendButtons[0]);

    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith('Server error');
      expect(screen.getAllByText('Send to 2 recipients').length).toBeGreaterThan(0); // Back to editing
    });

    alertMock.mockRestore();
  });

  it('displays available template variables help text', () => {
    render(<FinalConfirmationModal {...defaultProps} />);

    const availableVarsTexts = screen.getAllByText('Available variables:');
    expect(availableVarsTexts.length).toBeGreaterThan(0);

    // These variable names appear in multiple places (help text and potentially in templates)
    expect(screen.getAllByText('{{name}}').length).toBeGreaterThan(0);
    expect(screen.getAllByText('{{eventTitle}}').length).toBeGreaterThan(0);
    expect(screen.getAllByText('{{eventDate}}').length).toBeGreaterThan(0);
    expect(screen.getAllByText('{{eventLocation}}').length).toBeGreaterThan(0);
    expect(screen.getAllByText('{{siteUrl}}').length).toBeGreaterThan(0);
  });
});
