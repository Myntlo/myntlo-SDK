import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MyntloClient } from '../src/client';
import { MyntloNotFoundError } from '../src/errors';

const jsonHeaders = { 'content-type': 'application/json' };

const sampleDecision = {
  id: 'd1',
  meetingId: 'm1',
  orgId: 'o1',
  decision: 'Migrate to infrastructure v2',
  context: 'Discussed during infrastructure migration review',
  createdAt: '1',
};

describe('Decisions resource', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it('lists decisions', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ data: [sampleDecision], total: 1, page: 1, perPage: 20, hasMore: false }),
        { status: 200, headers: jsonHeaders },
      ),
    );

    const client = new MyntloClient({ apiKey: 'test-key' });
    const result = await client.decisions.list({ page: 1, perPage: 20 });

    expect(result.data).toEqual([sampleDecision]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/decisions');
    expect(String(url)).toContain('page=1');
    expect(String(url)).toContain('perPage=20');
    expect((init as RequestInit).method).toBe('GET');
  });

  it('gets a single decision, encoding the id', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(sampleDecision), { status: 200, headers: jsonHeaders }),
    );

    const client = new MyntloClient({ apiKey: 'test-key' });
    const result = await client.decisions.get('d 1');

    expect(result).toEqual(sampleDecision);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain(`/decisions/${encodeURIComponent('d 1')}`);
    expect((init as RequestInit).method).toBe('GET');
  });

  it('searches with the query-string overload', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ data: [sampleDecision], total: 1, page: 1, perPage: 10, hasMore: false }),
        { status: 200, headers: jsonHeaders },
      ),
    );

    const client = new MyntloClient({ apiKey: 'test-key' });
    const result = await client.decisions.search('infrastructure migration', { page: 1, perPage: 10 });

    expect(result.data).toEqual([sampleDecision]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/decisions/search');
    expect(String(url)).toContain('query=infrastructure');
    expect(String(url)).toContain('page=1');
    expect(String(url)).toContain('perPage=10');
    expect((init as RequestInit).method).toBe('GET');
  });

  it('searches with the options-object overload', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ data: [sampleDecision], total: 1, page: 1, perPage: 10, hasMore: false }),
        { status: 200, headers: jsonHeaders },
      ),
    );

    const client = new MyntloClient({ apiKey: 'test-key' });
    const result = await client.decisions.search({
      query: 'infrastructure migration',
      page: 1,
      perPage: 10,
    });

    expect(result.data).toEqual([sampleDecision]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/decisions/search');
    expect(String(url)).toContain('query=infrastructure');
    expect(String(url)).toContain('page=1');
    expect(String(url)).toContain('perPage=10');
    expect((init as RequestInit).method).toBe('GET');
  });

  it('iterates through paginated decisions', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: [{ ...sampleDecision, id: 'd1' }], total: 2, page: 1, perPage: 1, hasMore: true }),
          { status: 200, headers: jsonHeaders },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: [{ ...sampleDecision, id: 'd2' }], total: 2, page: 2, perPage: 1, hasMore: false }),
          { status: 200, headers: jsonHeaders },
        ),
      );

    const client = new MyntloClient({ apiKey: 'test-key' });
    const ids: string[] = [];

    for await (const decision of client.decisions.iterate({ perPage: 1 })) {
      ids.push(decision.id);
    }

    expect(ids).toEqual(['d1', 'd2']);
  });

  it('maps 404 to MyntloNotFoundError when getting a missing decision', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'missing' }), { status: 404, headers: jsonHeaders }),
    );

    const client = new MyntloClient({ apiKey: 'test-key', maxRetries: 0 });

    await expect(client.decisions.get('missing')).rejects.toBeInstanceOf(MyntloNotFoundError);
  });
});
