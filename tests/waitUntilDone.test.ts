import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { MyntloClient } from '../src/client';
import { MyntloAPIError, MyntloTimeoutError } from '../src/errors';

const jsonHeaders = { 'content-type': 'application/json' };

const processingStatus = { meetingId: 'm1', status: 'processing', stage: 'transcribing' };
const doneStatus = { meetingId: 'm1', status: 'done', stage: 'done' };
const failedStatus = { meetingId: 'm1', status: 'failed', stage: 'failed' };
const doneMeeting = { id: 'm1', orgId: 'o1', title: 'A', status: 'done', duration: 60, createdAt: '1', uploadedBy: 'u' };

function statusResponse(data: object) {
  return new Response(JSON.stringify(data), { status: 200, headers: jsonHeaders });
}

describe('meetings.waitUntilDone', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves with the meeting when status reaches done', async () => {
    fetchMock
      .mockResolvedValueOnce(statusResponse(processingStatus))
      .mockResolvedValueOnce(statusResponse(doneStatus))
      .mockResolvedValueOnce(statusResponse(doneMeeting));

    const client = new MyntloClient({ apiKey: 'test-key' });
    const promise = client.meetings.waitUntilDone('m1', { pollIntervalMs: 100, timeoutMs: 10000 });

    await vi.advanceTimersByTimeAsync(100);

    const result = await promise;
    expect(result.id).toBe('m1');
    expect(result.status).toBe('done');
  });

  it('throws MyntloAPIError when the meeting status is failed', async () => {
    fetchMock.mockResolvedValueOnce(statusResponse(failedStatus));

    const client = new MyntloClient({ apiKey: 'test-key' });
    const promise = client.meetings.waitUntilDone('m1', { pollIntervalMs: 100, timeoutMs: 10000 });

    await expect(promise).rejects.toBeInstanceOf(MyntloAPIError);
  });

  it('throws MyntloTimeoutError when timeout is exceeded', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(statusResponse(processingStatus)));

    const client = new MyntloClient({ apiKey: 'test-key' });
    // With timeoutMs:150 and pollIntervalMs:100:
    // t=0: status=processing, check 0+100>150? no → sleep(100)
    // t=100: status=processing, check 100+100>150? yes → throw
    const promise = client.meetings.waitUntilDone('m1', { pollIntervalMs: 100, timeoutMs: 150 });

    // Register the rejection handler before advancing timers to avoid unhandled rejection
    const expectation = expect(promise).rejects.toBeInstanceOf(MyntloTimeoutError);
    await vi.advanceTimersByTimeAsync(500);
    await expectation;
  });
});
