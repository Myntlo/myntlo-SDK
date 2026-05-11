# @myntlo/sdk

Official Myntlo API SDK for Node.js 18+ and modern browsers.

## Installation

```bash
npm install @myntlo/sdk
```

```bash
yarn add @myntlo/sdk
```

```bash
pnpm add @myntlo/sdk
```

## Quick start

```ts
import { MyntloClient } from '@myntlo/sdk';

const myntlo = new MyntloClient({ apiKey: 'myntlo_sk_...' });

const meeting = await myntlo.meetings.upload(fileInput.files[0], {
  title: 'Weekly Sync',
  participantEmails: ['team@myntlo.co'],
});

const decisions = await myntlo.decisions.list({ page: 1, perPage: 10 });
console.log(meeting.id, decisions.data);
```

## API reference

### Client

```ts
new MyntloClient({
  apiKey: string,
  baseUrl?: string,
  timeoutMs?: number,
  maxRetries?: number,
});
```

### Meetings

```ts
myntlo.meetings.list(options?: ListOptions): Promise<ListResponse<Meeting>>
myntlo.meetings.get(id: string): Promise<Meeting>
myntlo.meetings.upload(file: Uploadable, options?: UploadMeetingOptions): Promise<Meeting>
myntlo.meetings.getTranscript(id: string): Promise<MeetingTranscript>
myntlo.meetings.getExtractions(id: string): Promise<MeetingExtractions>
myntlo.meetings.iterate(options?: ListOptions): AsyncIterable<Meeting>
```

### Decisions

```ts
myntlo.decisions.list(options?: ListOptions): Promise<ListResponse<Decision>>
myntlo.decisions.get(id: string): Promise<Decision>
myntlo.decisions.search(options: DecisionSearchOptions): Promise<ListResponse<Decision>>
myntlo.decisions.iterate(options?: ListOptions): AsyncIterable<Decision>
```

### Action items

```ts
myntlo.actionItems.list(options?: ListOptions): Promise<ListResponse<ActionItem>>
myntlo.actionItems.get(id: string): Promise<ActionItem>
myntlo.actionItems.updateStatus(id: string, status: ActionItemStatus): Promise<ActionItem>
myntlo.actionItems.iterate(options?: ListOptions): AsyncIterable<ActionItem>
```

### Organizations

```ts
myntlo.organizations.get(): Promise<Organization>
myntlo.organizations.listMembers(options?: ListOptions): Promise<ListResponse<Member>>
```

### Webhooks

```ts
import { MyntloClient } from '@myntlo/sdk';

const event = await MyntloClient.verifyWebhook(payload, signature, secret);
```

## Error handling

```ts
import {
  MyntloAuthError,
  MyntloRateLimitError,
  MyntloNotFoundError,
  MyntloAPIError,
} from '@myntlo/sdk';

try {
  await myntlo.meetings.get('meeting_123');
} catch (error) {
  if (error instanceof MyntloAuthError) {
    console.error('Check your API key.');
  } else if (error instanceof MyntloRateLimitError) {
    console.error('Retry with backoff.');
  } else if (error instanceof MyntloNotFoundError) {
    console.error('Meeting not found.');
  } else if (error instanceof MyntloAPIError) {
    console.error('API error:', error.message);
  }
}
```

## Webhook verification

```ts
import { MyntloClient } from '@myntlo/sdk';

const signature = request.headers['myntlo-signature'];
const event = await MyntloClient.verifyWebhook(payload, signature, process.env.MYNTLO_WEBHOOK_SECRET);
```

## TypeScript usage

The SDK ships with full TypeScript types. Import models directly:

```ts
import type { Meeting, Decision, ActionItem, ListResponse } from '@myntlo/sdk';
```

## Pagination helper

```ts
for await (const meeting of myntlo.meetings.iterate({ perPage: 50 })) {
  console.log(meeting.id);
}
```

## Docs

See the full API documentation at https://docs.myntlo.co.
