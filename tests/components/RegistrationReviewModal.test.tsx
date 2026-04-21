import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import RegistrationReviewModal from '@/components/admin/RegistrationReviewModal';
import type { RegistrationRecord } from '@/lib/registration-store';
import type { Event } from '@/types/event';

describe('RegistrationReviewModal', () => {
  afterEach(() => {
    cleanup();
  });

  const mockRegistration: RegistrationRecord = {
    id: 'reg-123',
    eventId: 1,
    locale: 'en',
    name: 'John Doe',
    age: 30,
    profession: 'Engineer',
    email: 'john@example.com',
    instagram: '@johndoe',
    referral: 'BookDigestIG',
    bankAccount: '12345',
    timestamp: '2026-04-20T10:00:00Z',
    status: 'pending',
    createdAt: '2026-04-20T10:00:00Z',
    updatedAt: '2026-04-20T10:00:00Z',
  };

  const mockEvent: Event = {
    id: 1,
    slug: 'test-event',
    eventTypeCode: 'TW',
    venueId: 1,
    title: '測試活動',
    titleEn: 'Test Event',
    eventDate: '2026-05-16T19:00:00Z',
    registrationOpensAt: '2026-04-01T00:00:00Z',
    registrationClosesAt: '2026-05-15T23:59:59Z',
    isPublished: true,
    paymentAmount: 500,
    paymentCurrency: 'TWD',
    createdAt: '2026-04-01T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
  };

  const mockEmailConfig = {
    replyTo: 'test@bookdigest.com',
    siteUrl: 'https://bookdigest.com',
  };

  describe('Rendering with valid data', () => {
    it('should render modal with user information', () => {
      const onClose = vi.fn();
      const onConfirm = vi.fn();

      render(
        <RegistrationReviewModal
          registration={mockRegistration}
          event={mockEvent}
          emailConfig={mockEmailConfig}
          onClose={onClose}
          onConfirm={onConfirm}
        />
      );

      expect(screen.getByText('Review Registration')).toBeInTheDocument();
      expect(screen.getByText('User Information')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('john@example.com')).toBeInTheDocument();
      expect(screen.getByText('Engineer')).toBeInTheDocument();
      expect(screen.getByText('30')).toBeInTheDocument();
    });

    it('should render event information', () => {
      const onClose = vi.fn();
      const onConfirm = vi.fn();

      render(
        <RegistrationReviewModal
          registration={mockRegistration}
          event={mockEvent}
          emailConfig={mockEmailConfig}
          onClose={onClose}
          onConfirm={onConfirm}
        />
      );

      expect(screen.getByText('Event Information')).toBeInTheDocument();
      expect(screen.getByText('測試活動')).toBeInTheDocument();
    });

    it('should render payment information when paymentAmount is present', () => {
      const onClose = vi.fn();
      const onConfirm = vi.fn();

      render(
        <RegistrationReviewModal
          registration={mockRegistration}
          event={mockEvent}
          emailConfig={mockEmailConfig}
          onClose={onClose}
          onConfirm={onConfirm}
        />
      );

      expect(screen.getByText('Payment Information')).toBeInTheDocument();
      expect(screen.getByText('TWD 500')).toBeInTheDocument();
      expect(screen.getByText('12345')).toBeInTheDocument();
    });

    it('should not render payment section when paymentAmount is null and no bankAccount', () => {
      const eventWithoutPayment = { ...mockEvent, paymentAmount: null, paymentCurrency: null };
      const registrationWithoutBank = { ...mockRegistration, bankAccount: undefined };
      const onClose = vi.fn();
      const onConfirm = vi.fn();

      render(
        <RegistrationReviewModal
          registration={registrationWithoutBank}
          event={eventWithoutPayment}
          emailConfig={mockEmailConfig}
          onClose={onClose}
          onConfirm={onConfirm}
        />
      );

      expect(screen.queryByText('Payment Information')).not.toBeInTheDocument();
    });

    it('should render all three buttons', () => {
      const onClose = vi.fn();
      const onConfirm = vi.fn();
      const onCancel = vi.fn();

      render(
        <RegistrationReviewModal
          registration={mockRegistration}
          event={mockEvent}
          emailConfig={mockEmailConfig}
          onClose={onClose}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      );

      expect(screen.getByText('Cancel Registration')).toBeInTheDocument();
      expect(screen.getByText('Back')).toBeInTheDocument();
      expect(screen.getByText('Confirm Payment')).toBeInTheDocument();
    });

    it('should hide confirm button and show Close for confirmed registration', () => {
      const onClose = vi.fn();
      const onConfirm = vi.fn();
      const confirmedRegistration = { ...mockRegistration, status: 'confirmed' as const };

      render(
        <RegistrationReviewModal
          registration={confirmedRegistration}
          event={mockEvent}
          emailConfig={mockEmailConfig}
          onClose={onClose}
          onConfirm={onConfirm}
        />
      );

      expect(screen.queryByText('Confirm Payment')).not.toBeInTheDocument();
      expect(screen.queryByText('Back')).not.toBeInTheDocument();
      expect(screen.getByText('Close')).toBeInTheDocument();
    });
  });

  describe('Error handling when event is undefined', () => {
    it('should render error UI when event is undefined', () => {
      const onClose = vi.fn();
      const onConfirm = vi.fn();

      render(
        <RegistrationReviewModal
          registration={mockRegistration}
          event={undefined}
          emailConfig={mockEmailConfig}
          onClose={onClose}
          onConfirm={onConfirm}
        />
      );

      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.getByText('Event not found for this registration.')).toBeInTheDocument();
      expect(screen.getByText('Close')).toBeInTheDocument();
    });

    it('should call onClose when Close button clicked in error state', () => {
      const onClose = vi.fn();
      const onConfirm = vi.fn();

      const { unmount } = render(
        <RegistrationReviewModal
          registration={mockRegistration}
          event={undefined}
          emailConfig={mockEmailConfig}
          onClose={onClose}
          onConfirm={onConfirm}
        />
      );

      fireEvent.click(screen.getByText('Close'));
      expect(onClose).toHaveBeenCalledTimes(1);
      unmount();
    });
  });

  describe('User interactions', () => {
    it('should call onClose when Back button clicked', () => {
      const onClose = vi.fn();
      const onConfirm = vi.fn();

      render(
        <RegistrationReviewModal
          registration={mockRegistration}
          event={mockEvent}
          emailConfig={mockEmailConfig}
          onClose={onClose}
          onConfirm={onConfirm}
        />
      );

      fireEvent.click(screen.getByText('Back'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onConfirm and onClose when Confirm button clicked', async () => {
      const onClose = vi.fn();
      const onConfirm = vi.fn().mockResolvedValue(undefined);

      render(
        <RegistrationReviewModal
          registration={mockRegistration}
          event={mockEvent}
          emailConfig={mockEmailConfig}
          onClose={onClose}
          onConfirm={onConfirm}
        />
      );

      fireEvent.click(screen.getByText('Confirm Payment'));

      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(onClose).toHaveBeenCalledTimes(1);
      });
    });

    it('should show error message when onConfirm fails', async () => {
      const onClose = vi.fn();
      const onConfirm = vi.fn().mockRejectedValue(new Error('Payment confirmation failed'));

      render(
        <RegistrationReviewModal
          registration={mockRegistration}
          event={mockEvent}
          emailConfig={mockEmailConfig}
          onClose={onClose}
          onConfirm={onConfirm}
        />
      );

      fireEvent.click(screen.getByText('Confirm Payment'));

      await waitFor(() => {
        expect(screen.getByText('Payment confirmation failed')).toBeInTheDocument();
      });

      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onClose).not.toHaveBeenCalled();
    });

    it('should disable buttons and show loading state during confirmation', async () => {
      const onClose = vi.fn();
      const onConfirm = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(
        <RegistrationReviewModal
          registration={mockRegistration}
          event={mockEvent}
          emailConfig={mockEmailConfig}
          onClose={onClose}
          onConfirm={onConfirm}
        />
      );

      const confirmButton = screen.getByText('Confirm Payment');
      const backButton = screen.getByText('Back');

      fireEvent.click(confirmButton);

      // During loading
      await waitFor(() => {
        expect(screen.getByText('Confirming…')).toBeInTheDocument();
      });

      expect(backButton).toBeDisabled();

      // After completion
      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(onClose).toHaveBeenCalledTimes(1);
      });
    });

    it('should close modal when Escape key pressed', () => {
      const onClose = vi.fn();
      const onConfirm = vi.fn();

      render(
        <RegistrationReviewModal
          registration={mockRegistration}
          event={mockEvent}
          emailConfig={mockEmailConfig}
          onClose={onClose}
          onConfirm={onConfirm}
        />
      );

      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should close modal when overlay clicked', () => {
      const onClose = vi.fn();
      const onConfirm = vi.fn();

      render(
        <RegistrationReviewModal
          registration={mockRegistration}
          event={mockEvent}
          emailConfig={mockEmailConfig}
          onClose={onClose}
          onConfirm={onConfirm}
        />
      );

      const overlay = screen.getByRole('dialog');
      fireEvent.click(overlay);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should not close when clicking inside modal content', () => {
      const onClose = vi.fn();
      const onConfirm = vi.fn();

      render(
        <RegistrationReviewModal
          registration={mockRegistration}
          event={mockEvent}
          emailConfig={mockEmailConfig}
          onClose={onClose}
          onConfirm={onConfirm}
        />
      );

      fireEvent.click(screen.getByText('Review Registration'));
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
