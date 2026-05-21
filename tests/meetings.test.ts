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

  it('uploads a meeting via presigned URL flow', async () => {
    const meeting = {
      id: 'm1',
      orgId: 'o1',
      title: 'Upload',
      status: 'processing',
      duration: 0,
      createdAt: '1',
      uploadedBy: 'u',
    };

    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ uploadId: 'up1', uploadUrl: 'https://storage.test/upload', key: 'k1' }),
          { status: 200, headers: jsonHeaders },
        ),
      )
      .mockResolvedValueOnce(new Response('', { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(meeting), { status: 200, headers: jsonHeaders }));

    const client = new MyntloClient({ apiKey: 'test-key' });
    const result = await client.meetings.upload({ file: new Blob(['test']), title: 'Upload' });

    expect(result.id).toBe('m1');
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const [presignUrl, presignInit] = fetchMock.mock.calls[0];
    expect(String(presignUrl)).toContain('/uploads/presign');
    expect((presignInit as RequestInit).method).toBe('POST');

    const [storageUrl, storageInit] = fetchMock.mock.calls[1];
    expect(String(storageUrl)).toBe('https://storage.test/upload');
    expect((storageInit as RequestInit).method).toBe('PUT');

    const [completeUrl, completeInit] = fetchMock.mock.calls[2];
    expect(String(completeUrl)).toContain('/uploads/complete');
    expect((completeInit as RequestInit).method).toBe('POST');
  });
});
