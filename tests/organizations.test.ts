import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MyntloClient } from '../src/client';
import { MyntloAuthError } from '../src/errors';

const jsonHeaders = { 'content-type': 'application/json' };

const sampleOrganization = {
  id: 'o1',
  name: 'Acme Inc.',
  slug: 'acme',
  createdAt: '1',
};

const sampleMember = {
  id: 'mem1',
  userId: 'u1',
  email: 'alice@example.com',
  role: 'admin',
  joinedAt: '1',
};

describe('Organizations resource', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it('gets the current organization', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(sampleOrganization), { status: 200, headers: jsonHeaders }),
    );

    const client = new MyntloClient({ apiKey: 'test-key' });
    const result = await client.organizations.get();

    expect(result).toEqual(sampleOrganization);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/organizations');
    expect((init as RequestInit).method).toBe('GET');
  });

  it('lists organization members', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ data: [sampleMember], total: 1, page: 1, perPage: 20, hasMore: false }),
        { status: 200, headers: jsonHeaders },
      ),
    );

    const client = new MyntloClient({ apiKey: 'test-key' });
    const result = await client.organizations.listMembers({ page: 1, perPage: 20 });

    expect(result.data).toEqual([sampleMember]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/organizations/members');
    expect(String(url)).toContain('page=1');
    expect(String(url)).toContain('perPage=20');
    expect((init as RequestInit).method).toBe('GET');
  });

  it('maps 401 to MyntloAuthError when getting the organization', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'unauthorized' }), { status: 401, headers: jsonHeaders }),
    );

    const client = new MyntloClient({ apiKey: 'bad-key', maxRetries: 0 });

    await expect(client.organizations.get()).rejects.toBeInstanceOf(MyntloAuthError);
  });
});
