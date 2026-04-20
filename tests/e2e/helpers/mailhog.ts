/**
 * MailHog API helper for e2e tests
 *
 * MailHog provides an HTTP API to fetch emails sent during tests.
 * API docs: https://github.com/mailhog/MailHog/blob/master/docs/APIv2.md
 */

import libmime from 'libmime';

const MAILHOG_API_URL = process.env.MAILHOG_API_URL || 'http://localhost:8025/api/v2';

export type MailHogMessage = {
  ID: string;
  From: { Relays: null; Mailbox: string; Domain: string; Params: string };
  To: Array<{ Relays: null; Mailbox: string; Domain: string; Params: string }>;
  Content: {
    Headers: {
      Subject: string[];
      From: string[];
      To: string[];
      [key: string]: string[];
    };
    Body: string;
  };
  Created: string;
  MIME: null;
  Raw: {
    From: string;
    To: string[];
    Data: string;
  };
};

export type MailHogMessagesResponse = {
  total: number;
  count: number;
  start: number;
  items: MailHogMessage[];
};

/**
 * Fetch all messages from MailHog
 */
export async function getMailHogMessages(): Promise<MailHogMessagesResponse> {
  const response = await fetch(`${MAILHOG_API_URL}/messages`);
  if (!response.ok) {
    throw new Error(`MailHog API error: ${response.status}`);
  }
  return response.json();
}

/**
 * Find the most recent email sent to a specific recipient
 * Automatically decodes base64 encoded bodies and RFC 2047 encoded subjects
 */
export async function findEmailByRecipient(email: string): Promise<MailHogMessage | null> {
  const messages = await getMailHogMessages();
  const msg = messages.items.find(msg =>
    msg.To.some(to => `${to.Mailbox}@${to.Domain}` === email)
  ) || null;

  if (msg) {
    // Decode body if it's base64 encoded (common for non-ASCII content)
    if (msg.Content?.Body && msg.Content?.Headers?.['Content-Transfer-Encoding']?.[0] === 'base64') {
      try {
        msg.Content.Body = Buffer.from(msg.Content.Body, 'base64').toString('utf-8');
      } catch (error) {
        console.warn('Failed to decode base64 email body:', error);
      }
    }

    // Decode RFC 2047 encoded subject using libmime
    if (msg.Content?.Headers?.Subject?.[0]) {
      msg.Content.Headers.Subject[0] = new libmime.Libmime().decodeWords(msg.Content.Headers.Subject[0]);
    }
  }

  return msg;
}

/**
 * Find all emails sent to a specific recipient
 */
export async function findAllEmailsByRecipient(email: string): Promise<MailHogMessage[]> {
  const messages = await getMailHogMessages();
  return messages.items.filter(msg =>
    msg.To.some(to => `${to.Mailbox}@${to.Domain}` === email)
  );
}

/**
 * Find email by subject (partial match)
 */
export async function findEmailBySubject(subject: string): Promise<MailHogMessage | null> {
  const messages = await getMailHogMessages();
  return messages.items.find(msg =>
    msg.Content.Headers.Subject?.[0]?.includes(subject)
  ) || null;
}

/**
 * Delete all messages from MailHog
 * Note: DELETE endpoint is only available in v1 API
 */
export async function clearMailHogMessages(): Promise<void> {
  const baseUrl = MAILHOG_API_URL.replace('/api/v2', '/api/v1');
  const response = await fetch(`${baseUrl}/messages`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`MailHog API error: ${response.status}`);
  }
}

/**
 * Wait for an email to arrive (with timeout)
 */
export async function waitForEmail(
  recipient: string,
  options: { timeout?: number; interval?: number } = {}
): Promise<MailHogMessage> {
  const { timeout = 10000, interval = 500 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const email = await findEmailByRecipient(recipient);
    if (email) {
      return email;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(`Email to ${recipient} not received within ${timeout}ms`);
}
