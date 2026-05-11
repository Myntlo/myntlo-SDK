import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { MyntloClient } from '../src/client';
import { MyntloTimeoutError } from '../src/errors';

const jsonHeaders = { 'content-type': 'application/json' };

describe('MyntloClient', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends authorization and base URL', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [], total: 0, page: 1, perPage: 20, hasMore: false }), {
        status: 200,
        headers: jsonHeaders,
      }),
    );

    const client = new MyntloClient({ apiKey: 'test-key', baseUrl: 'https://api.test/v1' });
    await client.meetings.list();

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://api.test/v1/meetings');
    expect((init as RequestInit).headers).toBeInstanceOf(Headers);
    const headers = (init as RequestInit).headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer test-key');
  });

  it('retries on 5xx responses', async () => {
    vi.useFakeTimers();

    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'server down' }), { status: 500, headers: jsonHeaders }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [], total: 0, page: 1, perPage: 20, hasMore: false }), {
          status: 200,
          headers: jsonHeaders,
        }),
      );

    const client = new MyntloClient({ apiKey: 'test-key', maxRetries: 2 });
    const promise = client.meetings.list();

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.data).toHaveLength(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws a timeout error when the request exceeds the timeout', async () => {
    vi.useFakeTimers();

    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const error = new Error('AbortError');
          (error as { name?: string }).name = 'AbortError';
          reject(error);
        });
      });
    });

    const client = new MyntloClient({ apiKey: 'test-key', timeoutMs: 10, maxRetries: 0 });
    const promise = client.meetings.list();
    const expectation = expect(promise).rejects.toBeInstanceOf(MyntloTimeoutError);

    await vi.advanceTimersByTimeAsync(20);
    await expectation;
  });
});
