import type { Decision, DecisionSearchOptions, ListOptions, ListResponse } from '../types';
import type { MyntloClient } from '../client';

export class DecisionsResource {
  constructor(private readonly client: MyntloClient) {}

  list(options: ListOptions = {}): Promise<ListResponse<Decision>> {
    return this.client.request('GET', '/decisions', { query: options });
  }

  get(id: string): Promise<Decision> {
    return this.client.request('GET', `/decisions/${encodeURIComponent(id)}`);
  }

  search(query: string, options?: ListOptions): Promise<ListResponse<Decision>>;
  search(options: DecisionSearchOptions): Promise<ListResponse<Decision>>;
  search(
    queryOrOptions: string | DecisionSearchOptions,
    listOptions?: ListOptions,
  ): Promise<ListResponse<Decision>> {
    if (typeof queryOrOptions === 'string') {
      return this.client.request('GET', '/decisions/search', {
        query: { query: queryOrOptions, ...listOptions },
      });
    }
    return this.client.request('GET', '/decisions/search', { query: queryOrOptions });
  }

  async *iterate(options: ListOptions = {}): AsyncGenerator<Decision> {
    let page = options.page ?? 1;
    const perPage = options.perPage ?? 50;
    let hasMore = true;

    while (hasMore) {
      const response = await this.list({ page, perPage, cursor: options.cursor });
      for (const item of response.data) {
        yield item;
      }
      hasMore = response.hasMore;
      page += 1;
    }
  }
}
