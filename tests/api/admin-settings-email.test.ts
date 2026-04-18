// Related to FEATURE-001
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, PUT } from '@/app/api/admin/settings/email/route';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/observability', () => ({
  runWithRequestTrace: vi.fn((req, name, fn) => fn()),
}));

vi.mock('@/lib/email-service', () => ({
  getEmailSettings: vi.fn(),
  updateEmailSettings: vi.fn(),
}));

import { getEmailSettings, updateEmailSettings } from '@/lib/email-service';

describe('GET /api/admin/settings/email', () => {
  const ADMIN_PASSWORD = 'test-admin-password';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_PASSWORD = ADMIN_PASSWORD;
  });

  it('should return 401 if no authorization header', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/settings/email', {
      method: 'GET',
    });

    const response = await GET(req);
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 401 if invalid token', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/settings/email', {
      method: 'GET',
      headers: { Authorization: 'Bearer wrong-token' },
    });

    const response = await GET(req);
    expect(response.status).toBe(401);
  });

  it('should return email settings successfully', async () => {
    vi.mocked(getEmailSettings).mockResolvedValue({
      reservationConfirmationEnabled: false,
    });

    const req = new NextRequest('http://localhost:3000/api/admin/settings/email', {
      method: 'GET',
      headers: { Authorization: `Bearer ${ADMIN_PASSWORD}` },
    });

    const response = await GET(req);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.settings).toEqual({
      reservationConfirmationEnabled: false,
    });

    expect(getEmailSettings).toHaveBeenCalledOnce();
  });

  it('should return 500 if getEmailSettings fails', async () => {
    vi.mocked(getEmailSettings).mockRejectedValue(new Error('Database error'));

    const req = new NextRequest('http://localhost:3000/api/admin/settings/email', {
      method: 'GET',
      headers: { Authorization: `Bearer ${ADMIN_PASSWORD}` },
    });

    const response = await GET(req);
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.ok).toBe(false);
    expect(data.error).toBe('Database error');
  });
});

describe('PUT /api/admin/settings/email', () => {
  const ADMIN_PASSWORD = 'test-admin-password';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_PASSWORD = ADMIN_PASSWORD;
  });

  it('should return 401 if no authorization header', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/settings/email', {
      method: 'PUT',
      body: JSON.stringify({ reservationConfirmationEnabled: true }),
    });

    const response = await PUT(req);
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 401 if invalid token', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/settings/email', {
      method: 'PUT',
      headers: { Authorization: 'Bearer wrong-token' },
      body: JSON.stringify({ reservationConfirmationEnabled: true }),
    });

    const response = await PUT(req);
    expect(response.status).toBe(401);
  });

  it('should return 400 if reservationConfirmationEnabled missing', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/settings/email', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${ADMIN_PASSWORD}` },
      body: JSON.stringify({}),
    });

    const response = await PUT(req);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('reservationConfirmationEnabled must be a boolean');
  });

  it('should return 400 if reservationConfirmationEnabled is not boolean', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/settings/email', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${ADMIN_PASSWORD}` },
      body: JSON.stringify({ reservationConfirmationEnabled: 'true' }),
    });

    const response = await PUT(req);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('reservationConfirmationEnabled must be a boolean');
  });

  it('should update settings to enabled successfully', async () => {
    vi.mocked(updateEmailSettings).mockResolvedValue();

    const req = new NextRequest('http://localhost:3000/api/admin/settings/email', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${ADMIN_PASSWORD}` },
      body: JSON.stringify({ reservationConfirmationEnabled: true }),
    });

    const response = await PUT(req);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.message).toBe('Email settings updated successfully');

    expect(updateEmailSettings).toHaveBeenCalledWith({
      reservationConfirmationEnabled: true,
    });
  });

  it('should update settings to disabled successfully', async () => {
    vi.mocked(updateEmailSettings).mockResolvedValue();

    const req = new NextRequest('http://localhost:3000/api/admin/settings/email', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${ADMIN_PASSWORD}` },
      body: JSON.stringify({ reservationConfirmationEnabled: false }),
    });

    const response = await PUT(req);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);

    expect(updateEmailSettings).toHaveBeenCalledWith({
      reservationConfirmationEnabled: false,
    });
  });

  it('should return 500 if updateEmailSettings fails', async () => {
    vi.mocked(updateEmailSettings).mockRejectedValue(new Error('Database error'));

    const req = new NextRequest('http://localhost:3000/api/admin/settings/email', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${ADMIN_PASSWORD}` },
      body: JSON.stringify({ reservationConfirmationEnabled: true }),
    });

    const response = await PUT(req);
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.ok).toBe(false);
    expect(data.error).toBe('Database error');
  });
});
