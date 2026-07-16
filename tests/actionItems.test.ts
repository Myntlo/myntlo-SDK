import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MyntloClient } from '../src/client';
import { MyntloNotFoundError } from '../src/errors';

const jsonHeaders = { 'content-type': 'application/json' };

const sampleActionItem = {
  id: 'ai_1',
  meetingId: 'm1',
  orgId: 'o1',
  assignedToName: 'Alice',
  task: 'Follow up with legal team',
  dueDate: '2026-06-01',
  status: 'pending',
  createdAt: '1',
};

describe('ActionItems resource', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it('lists action items', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ data: [sampleActionItem], total: 1, page: 1, perPage: 25, hasMore: false }),
        { status: 200, headers: jsonHeaders },
      ),
    );

    const client = new MyntloClient({ apiKey: 'test-key' });
    const result = await client.actionItems.list({ page: 1, perPage: 25 });

    expect(result.data).toEqual([sampleActionItem]);
    expect(result.total).toBe(1);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/action-items');
    expect(String(url)).toContain('page=1');
    expect(String(url)).toContain('perPage=25');
    expect((init as RequestInit).method).toBe('GET');
  });

  it('gets a single action item, encoding the id', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(sampleActionItem), { status: 200, headers: jsonHeaders }),
    );

    const client = new MyntloClient({ apiKey: 'test-key' });
    const result = await client.actionItems.get('ai 1');

    expect(result).toEqual(sampleActionItem);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain(`/action-items/${encodeURIComponent('ai 1')}`);
    expect((init as RequestInit).method).toBe('GET');
  });

  it('creates an action item', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(sampleActionItem), { status: 200, headers: jsonHeaders }),
    );

    const client = new MyntloClient({ apiKey: 'test-key' });
    const input = {
      meetingId: 'm1',
      task: 'Follow up with legal team',
      assignedToName: 'Alice',
      dueDate: '2026-06-01',
    };
    const result = await client.actionItems.create(input);

    expect(result).toEqual(sampleActionItem);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/action-items');
    expect((init as RequestInit).method).toBe('POST');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual(input);
  });

  it('updates an action item', async () => {
    const updated = { ...sampleActionItem, task: 'Follow up with legal and finance teams' };
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(updated), { status: 200, headers: jsonHeaders }),
    );

    const client = new MyntloClient({ apiKey: 'test-key' });
    const input = { task: 'Follow up with legal and finance teams', dueDate: '2026-06-15' };
    const result = await client.actionItems.update('ai_1', input);

    expect(result).toEqual(updated);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/action-items/ai_1');
    expect((init as RequestInit).method).toBe('PATCH');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual(input);
  });

  it('updates action item status', async () => {
    const updated = { ...sampleActionItem, status: 'done' };
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(updated), { status: 200, headers: jsonHeaders }),
    );

    const client = new MyntloClient({ apiKey: 'test-key' });
    const result = await client.actionItems.updateStatus('ai_1', 'done');

    expect(result).toEqual(updated);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/action-items/ai_1/status');
    expect((init as RequestInit).method).toBe('PATCH');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ status: 'done' });
  });

  it('marks an action item as done via updateStatus', async () => {
    const updated = { ...sampleActionItem, status: 'done' };
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(updated), { status: 200, headers: jsonHeaders }),
    );

    const client = new MyntloClient({ apiKey: 'test-key' });
    const result = await client.actionItems.markDone('ai_1');

    expect(result.status).toBe('done');

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/action-items/ai_1/status');
    expect((init as RequestInit).method).toBe('PATCH');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ status: 'done' });
  });

  it('deletes an action item', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    const client = new MyntloClient({ apiKey: 'test-key' });
    const result = await client.actionItems.delete('ai_1');

    expect(result).toBeUndefined();

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/action-items/ai_1');
    expect((init as RequestInit).method).toBe('DELETE');
  });

  it('iterates through paginated action items', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: [{ ...sampleActionItem, id: 'ai_1' }], total: 2, page: 1, perPage: 1, hasMore: true }),
          { status: 200, headers: jsonHeaders },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: [{ ...sampleActionItem, id: 'ai_2' }], total: 2, page: 2, perPage: 1, hasMore: false }),
          { status: 200, headers: jsonHeaders },
        ),
      );

    const client = new MyntloClient({ apiKey: 'test-key' });
    const ids: string[] = [];

    for await (const item of client.actionItems.iterate({ perPage: 1 })) {
      ids.push(item.id);
    }

    expect(ids).toEqual(['ai_1', 'ai_2']);
  });

  it('maps 404 to MyntloNotFoundError when getting a missing action item', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'missing' }), { status: 404, headers: jsonHeaders }),
    );

    const client = new MyntloClient({ apiKey: 'test-key', maxRetries: 0 });

    await expect(client.actionItems.get('missing')).rejects.toBeInstanceOf(MyntloNotFoundError);
  });
});
