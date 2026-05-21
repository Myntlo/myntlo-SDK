import type {
  ActionItem,
  ActionItemStatus,
  ActionItemUpdateStatusRequest,
  ListOptions,
  ListResponse,
} from '../types';
import type { MyntloClient } from '../client';

export type ActionItemCreateInput = {
  meetingId: string;
  assignedToName?: string;
  task: string;
  dueDate?: string | null;
};

export type ActionItemUpdateInput = {
  assignedToName?: string;
  task?: string;
  dueDate?: string | null;
  status?: ActionItemStatus;
};

export class ActionItemsResource {
  constructor(private readonly client: MyntloClient) {}

  list(options: ListOptions = {}): Promise<ListResponse<ActionItem>> {
    return this.client.request('GET', '/action-items', { query: options });
  }

  get(id: string): Promise<ActionItem> {
    return this.client.request('GET', `/action-items/${encodeURIComponent(id)}`);
  }

  create(data: ActionItemCreateInput): Promise<ActionItem> {
    return this.client.request('POST', '/action-items', { body: data });
  }

  update(id: string, data: ActionItemUpdateInput): Promise<ActionItem> {
    return this.client.request('PATCH', `/action-items/${encodeURIComponent(id)}`, { body: data });
  }

  updateStatus(id: string, status: ActionItemStatus): Promise<ActionItem> {
    const body: ActionItemUpdateStatusRequest = { status };
    return this.client.request('PATCH', `/action-items/${encodeURIComponent(id)}/status`, { body });
  }

  markDone(id: string): Promise<ActionItem> {
    return this.updateStatus(id, 'done');
  }

  delete(id: string): Promise<void> {
    return this.client.request('DELETE', `/action-items/${encodeURIComponent(id)}`);
  }

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
