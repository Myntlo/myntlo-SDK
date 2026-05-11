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
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await globalThis.crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return bufferToHex(new Uint8Array(signature));
}

function bufferToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
