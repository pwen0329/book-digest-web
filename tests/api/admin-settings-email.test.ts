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

vi.mock('@/lib/admin-auth', () => ({
  isAuthorizedAdminRequest: vi.fn(),
}));

import { getEmailSettings, updateEmailSettings } from '@/lib/email-service';
import { isAuthorizedAdminRequest } from '@/lib/admin-auth';

describe('GET /api/admin/settings/email', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 if not authorized', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(false);

    const req = new NextRequest('http://localhost:3000/api/admin/settings/email', {
      method: 'GET',
    });

    const response = await GET(req);
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 401 if invalid token', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(false);

    const req = new NextRequest('http://localhost:3000/api/admin/settings/email', {
      method: 'GET',
      headers: { Authorization: 'Bearer wrong-token' },
    });

    const response = await GET(req);
    expect(response.status).toBe(401);
  });

  it('should return email settings successfully', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);
    vi.mocked(getEmailSettings).mockResolvedValue({
      registrationEmailEnabled: false,
      emailConfigured: true,
      providerName: 'resend',
      resendConfigured: true,
      gmailConfigured: false,
      activeProvider: 'resend',
    });

    const req = new NextRequest('http://localhost:3000/api/admin/settings/email', {
      method: 'GET',
    });

    const response = await GET(req);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.settings).toEqual({
      registrationEmailEnabled: false,
      emailConfigured: true,
      providerName: 'resend',
      resendConfigured: true,
      gmailConfigured: false,
      activeProvider: 'resend',
    });

    expect(getEmailSettings).toHaveBeenCalledOnce();
  });

  it('should return 500 if getEmailSettings fails', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);
    vi.mocked(getEmailSettings).mockRejectedValue(new Error('Database error'));

    const req = new NextRequest('http://localhost:3000/api/admin/settings/email', {
      method: 'GET',
    });

    const response = await GET(req);
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.ok).toBe(false);
    expect(data.error).toBe('Database error');
  });
});

describe('PUT /api/admin/settings/email', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 if not authorized', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(false);

    const req = new NextRequest('http://localhost:3000/api/admin/settings/email', {
      method: 'PUT',
      body: JSON.stringify({ registrationEmailEnabled: true }),
    });

    const response = await PUT(req);
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 401 if invalid token', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(false);

    const req = new NextRequest('http://localhost:3000/api/admin/settings/email', {
      method: 'PUT',
      headers: { Authorization: 'Bearer wrong-token' },
      body: JSON.stringify({ registrationEmailEnabled: true }),
    });

    const response = await PUT(req);
    expect(response.status).toBe(401);
  });

  it('should return 400 if registrationEmailEnabled missing', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);

    const req = new NextRequest('http://localhost:3000/api/admin/settings/email', {
      method: 'PUT',
      body: JSON.stringify({}),
    });

    const response = await PUT(req);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('registrationEmailEnabled must be a boolean');
  });

  it('should return 400 if registrationEmailEnabled is not boolean', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);

    const req = new NextRequest('http://localhost:3000/api/admin/settings/email', {
      method: 'PUT',
      body: JSON.stringify({ registrationEmailEnabled: 'true' }),
    });

    const response = await PUT(req);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('registrationEmailEnabled must be a boolean');
  });

  it('should update settings to enabled successfully', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);
    vi.mocked(updateEmailSettings).mockResolvedValue();

    const req = new NextRequest('http://localhost:3000/api/admin/settings/email', {
      method: 'PUT',
      body: JSON.stringify({ registrationEmailEnabled: true }),
    });

    const response = await PUT(req);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.message).toBe('Email settings updated successfully');

    expect(updateEmailSettings).toHaveBeenCalledWith({
      registrationEmailEnabled: true,
    });
  });

  it('should update settings to disabled successfully', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);
    vi.mocked(updateEmailSettings).mockResolvedValue();

    const req = new NextRequest('http://localhost:3000/api/admin/settings/email', {
      method: 'PUT',
      body: JSON.stringify({ registrationEmailEnabled: false }),
    });

    const response = await PUT(req);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);

    expect(updateEmailSettings).toHaveBeenCalledWith({
      registrationEmailEnabled: false,
    });
  });

  it('should return 500 if updateEmailSettings fails', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);
    vi.mocked(updateEmailSettings).mockRejectedValue(new Error('Database error'));

    const req = new NextRequest('http://localhost:3000/api/admin/settings/email', {
      method: 'PUT',
      body: JSON.stringify({ registrationEmailEnabled: true }),
    });

    const response = await PUT(req);
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.ok).toBe(false);
    expect(data.error).toBe('Database error');
  });
});
