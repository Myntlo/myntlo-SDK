import type { Decision, DecisionSearchOptions, ListOptions, ListResponse } from '../types';
import type { MyntloClient } from '../client';

export class DecisionsResource {
  constructor(private readonly client: MyntloClient) {}

  /** List decisions with pagination. */
  list(options: ListOptions = {}): Promise<ListResponse<Decision>> {
    return this.client.request('GET', '/decisions', { query: options });
  }

  /** Get a decision by ID. */
  get(id: string): Promise<Decision> {
    return this.client.request('GET', `/decisions/${encodeURIComponent(id)}`);
  }

  /** Search decisions by query string. */
  search(options: DecisionSearchOptions): Promise<ListResponse<Decision>> {
    return this.client.request('GET', '/decisions/search', { query: options });
  }

  /** Iterate through all decisions. */
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
