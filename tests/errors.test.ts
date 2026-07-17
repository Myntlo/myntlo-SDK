import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MyntloClient } from '../src/client';
import {
  MyntloAuthError,
  MyntloNotFoundError,
  MyntloRateLimitError,
} from '../src/errors';

const jsonHeaders = { 'content-type': 'application/json' };

describe('Myntlo errors', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it('maps 401 to MyntloAuthError', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'unauthorized' }), { status: 401, headers: jsonHeaders }),
    );

    const client = new MyntloClient({ apiKey: 'bad-key', maxRetries: 0 });

    await expect(client.meetings.list()).rejects.toBeInstanceOf(MyntloAuthError);
  });

  it('maps 404 to MyntloNotFoundError', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'missing' }), { status: 404, headers: jsonHeaders }),
    );

    const client = new MyntloClient({ apiKey: 'test-key', maxRetries: 0 });

    await expect(client.meetings.get('missing')).rejects.toBeInstanceOf(MyntloNotFoundError);
  });

  it('maps 429 to MyntloRateLimitError', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'rate limit' }), { status: 429, headers: jsonHeaders }),
    );

    const client = new MyntloClient({ apiKey: 'test-key', maxRetries: 0 });

    await expect(client.meetings.list()).rejects.toBeInstanceOf(MyntloRateLimitError);
  });

  it('surfaces retryAfterSeconds from a numeric Retry-After header', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'rate limit' }), {
        status: 429,
        headers: { ...jsonHeaders, 'retry-after': '42' },
      }),
    );

    const client = new MyntloClient({ apiKey: 'test-key', maxRetries: 0 });

    await expect(client.meetings.list()).rejects.toMatchObject({ retryAfterSeconds: 42 });
  });

  it('parses an HTTP-date Retry-After header into seconds-from-now', async () => {
    const futureDate = new Date(Date.now() + 30_000);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'rate limit' }), {
        status: 429,
        headers: { ...jsonHeaders, 'retry-after': futureDate.toUTCString() },
      }),
    );

    const client = new MyntloClient({ apiKey: 'test-key', maxRetries: 0 });

    try {
      await client.meetings.list();
      expect.unreachable('expected MyntloRateLimitError to be thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(MyntloRateLimitError);
      const rateLimitErr = err as MyntloRateLimitError;
      // Allow a little slack for test execution time between Date.now() calls.
      expect(rateLimitErr.retryAfterSeconds).toBeGreaterThanOrEqual(28);
      expect(rateLimitErr.retryAfterSeconds).toBeLessThanOrEqual(30);
    }
  });

  it('leaves retryAfterSeconds undefined when the header is absent', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'rate limit' }), { status: 429, headers: jsonHeaders }),
    );

    const client = new MyntloClient({ apiKey: 'test-key', maxRetries: 0 });

    await expect(client.meetings.list()).rejects.toMatchObject({ retryAfterSeconds: undefined });
  });

  it('waits for retryAfterSeconds (not exponential backoff) before an automatic retry', async () => {
    vi.useFakeTimers();
    try {
      fetchMock
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ message: 'rate limit' }), {
            status: 429,
            headers: { ...jsonHeaders, 'retry-after': '7' },
          }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ meetings: [] }), { status: 200, headers: jsonHeaders }),
        );

      const client = new MyntloClient({ apiKey: 'test-key', maxRetries: 1 });
      const listPromise = client.meetings.list();

      await vi.advanceTimersByTimeAsync(6_900);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(200);
      await listPromise;
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('verifies webhook signatures', async () => {
    const secret = 'whsec_test';
    const payload = JSON.stringify({ id: 'evt_1', type: 'meeting.processing' });
    const signature = await signWebhook(payload, secret);

    const event = await MyntloClient.verifyWebhook(payload, signature, secret);

    expect(event.type).toBe('meeting.processing');
  });
});

async function signWebhook(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const payloadBytes = encoder.encode(payload);

  if (globalThis.crypto?.subtle) {
    const key = await globalThis.crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const signature = await globalThis.crypto.subtle.sign('HMAC', key, payloadBytes);
    return bufferToHex(new Uint8Array(signature));
  }

  const { createHmac } = await import('node:crypto');
  return createHmac('sha256', secret).update(payloadBytes).digest('hex');
}

function bufferToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
