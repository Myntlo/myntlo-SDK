import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MyntloClient } from '../src/client';
import { MyntloAPIError } from '../src/errors';

function sseResponse(rawFrames: string[], status = 200): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const frame of rawFrames) {
        controller.enqueue(encoder.encode(frame));
      }
      controller.close();
    },
  });
  return new Response(stream, { status, headers: { 'content-type': 'text/event-stream' } });
}

describe('meetings.watchStatus', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it('yields each event and stops after a terminal stage', async () => {
    fetchMock.mockResolvedValueOnce(
      sseResponse([
        'data: {"processingStage":"transcribing","errorMessage":null}\n\n',
        'data: {"processingStage":"extracting_insights","errorMessage":null}\n\n',
        'data: {"processingStage":"done","errorMessage":null}\n\n',
      ]),
    );

    const client = new MyntloClient({ apiKey: 'test-key' });
    const events = [];
    for await (const event of client.meetings.watchStatus('m1')) {
      events.push(event);
    }

    expect(events).toEqual([
      { processingStage: 'transcribing', errorMessage: null },
      { processingStage: 'extracting_insights', errorMessage: null },
      { processingStage: 'done', errorMessage: null },
    ]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/meetings/m1/status/stream');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-key');
  });

  it('stops after a failed stage without yielding further events', async () => {
    fetchMock.mockResolvedValueOnce(
      sseResponse([
        'data: {"processingStage":"failed","errorMessage":"transcription error"}\n\n',
        'data: {"processingStage":"done","errorMessage":null}\n\n',
      ]),
    );

    const client = new MyntloClient({ apiKey: 'test-key' });
    const events = [];
    for await (const event of client.meetings.watchStatus('m1')) {
      events.push(event);
    }

    expect(events).toEqual([{ processingStage: 'failed', errorMessage: 'transcription error' }]);
  });

  it('ignores keepalive comment lines', async () => {
    fetchMock.mockResolvedValueOnce(
      sseResponse([
        ': keepalive\n\n',
        'data: {"processingStage":"done","errorMessage":null}\n\n',
      ]),
    );

    const client = new MyntloClient({ apiKey: 'test-key' });
    const events = [];
    for await (const event of client.meetings.watchStatus('m1')) {
      events.push(event);
    }

    expect(events).toEqual([{ processingStage: 'done', errorMessage: null }]);
  });

  it('handles an SSE event split across multiple stream chunks', async () => {
    fetchMock.mockResolvedValueOnce(
      sseResponse(['data: {"processingS', 'tage":"done","errorMessage":null}\n\n']),
    );

    const client = new MyntloClient({ apiKey: 'test-key' });
    const events = [];
    for await (const event of client.meetings.watchStatus('m1')) {
      events.push(event);
    }

    expect(events).toEqual([{ processingStage: 'done', errorMessage: null }]);
  });

  it('throws MyntloAPIError when the connection cannot be opened', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));

    const client = new MyntloClient({ apiKey: 'test-key' });
    await expect(client.meetings.watchStatus('missing').next()).rejects.toBeInstanceOf(MyntloAPIError);
  });

  it('stops consuming once the caller breaks out of the loop early', async () => {
    fetchMock.mockResolvedValueOnce(
      sseResponse([
        'data: {"processingStage":"transcribing","errorMessage":null}\n\n',
        'data: {"processingStage":"extracting_insights","errorMessage":null}\n\n',
        'data: {"processingStage":"done","errorMessage":null}\n\n',
      ]),
    );

    const client = new MyntloClient({ apiKey: 'test-key' });
    const events = [];
    for await (const event of client.meetings.watchStatus('m1')) {
      events.push(event);
      if (event.processingStage === 'transcribing') break;
    }

    expect(events).toEqual([{ processingStage: 'transcribing', errorMessage: null }]);
  });
});
