import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MyntloClient } from '../src/client';

const jsonHeaders = { 'content-type': 'application/json' };

describe('Meetings resource', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it('iterates through paginated results', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [{ id: 'm1', orgId: 'o1', title: 'A', status: 'done', duration: 10, createdAt: '1', uploadedBy: 'u' }],
            total: 2,
            page: 1,
            perPage: 1,
            hasMore: true,
          }),
          { status: 200, headers: jsonHeaders },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [{ id: 'm2', orgId: 'o1', title: 'B', status: 'done', duration: 5, createdAt: '2', uploadedBy: 'u' }],
            total: 2,
            page: 2,
            perPage: 1,
            hasMore: false,
          }),
          { status: 200, headers: jsonHeaders },
        ),
      );

    const client = new MyntloClient({ apiKey: 'test-key' });
    const meetings: string[] = [];

    for await (const meeting of client.meetings.iterate({ perPage: 1 })) {
      meetings.push(meeting.id);
    }

    expect(meetings).toEqual(['m1', 'm2']);
  });

  it('uploads a meeting', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 'm1',
          orgId: 'o1',
          title: 'Upload',
          status: 'processing',
          duration: 0,
          createdAt: '1',
          uploadedBy: 'u',
        }),
        { status: 200, headers: jsonHeaders },
      ),
    );

    const client = new MyntloClient({ apiKey: 'test-key' });
    const meeting = await client.meetings.upload(new Blob(['test']), { title: 'Upload' });

    expect(meeting.id).toBe('m1');
    const [, init] = fetchMock.mock.calls[0];
    expect((init as RequestInit).method).toBe('POST');
  });
});
