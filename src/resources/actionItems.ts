import type {
  ActionItem,
  ActionItemStatus,
  ActionItemUpdateStatusRequest,
  ListOptions,
  ListResponse,
} from '../types';
import type { MyntloClient } from '../client';

export class ActionItemsResource {
  constructor(private readonly client: MyntloClient) {}

  /** List action items with pagination. */
  list(options: ListOptions = {}): Promise<ListResponse<ActionItem>> {
    return this.client.request('GET', '/action-items', { query: options });
  }

  /** Get an action item by ID. */
  get(id: string): Promise<ActionItem> {
    return this.client.request('GET', `/action-items/${encodeURIComponent(id)}`);
  }

  /** Update an action item status. */
  updateStatus(id: string, status: ActionItemStatus): Promise<ActionItem> {
    const body: ActionItemUpdateStatusRequest = { status };
    return this.client.request('PATCH', `/action-items/${encodeURIComponent(id)}/status`, {
      body,
    });
  }

  /** Iterate through all action items. */
  async *iterate(options: ListOptions = {}): AsyncGenerator<ActionItem> {
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
