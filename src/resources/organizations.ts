import type { ListOptions, ListResponse, Member, Organization } from '../types';
import type { MyntloClient } from '../client';

export class OrganizationsResource {
  constructor(private readonly client: MyntloClient) {}

  /** Get the current organization. */
  get(): Promise<Organization> {
    return this.client.request('GET', '/organizations');
  }

  /** List organization members. */
  listMembers(options: ListOptions = {}): Promise<ListResponse<Member>> {
    return this.client.request('GET', '/organizations/members', { query: options });
  }
}
