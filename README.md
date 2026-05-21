# @myntlo/sdk

Official Myntlo API SDK for Node.js 18+ and modern browsers.

## Installation

```bash
npm install @myntlo/sdk
# or
yarn add @myntlo/sdk
# or
pnpm add @myntlo/sdk
```

## Quick start

```ts
import { MyntloClient } from '@myntlo/sdk';

const myntlo = new MyntloClient({
  apiKey: process.env.MYNTLO_API_KEY!,
  baseUrl: 'https://api.myntlo.com',
});
```

## Uploading a meeting

**Browser** — pass a `File` or `Blob`:

```ts
const fileInput = document.querySelector('input[type="file"]')!;
const file = fileInput.files![0];

const meeting = await myntlo.meetings.upload({
  file,
  title: 'Engineering Standup',
  participantEmails: ['alice@example.com', 'bob@example.com'],
});

console.log('Meeting created:', meeting.id, meeting.status);
```

**Node.js** — pass a file path:

```ts
const meeting = await myntlo.meetings.uploadFile({
  path: './recordings/investor-call.mp3',
  title: 'Investor Call',
});

console.log('Meeting created:', meeting.id);
```

## Waiting for processing to finish

Poll until the meeting is fully processed or throw on failure / timeout:

```ts
const meeting = await myntlo.meetings.waitUntilDone(meeting.id, {
  pollIntervalMs: 3000,   // check every 3 seconds (default)
  timeoutMs: 600000,      // give up after 10 minutes (default)
});

console.log('Processing complete:', meeting.status); // "done"
```

## Reading meeting intelligence

```ts
// Full transcript
const { transcript } = await myntlo.meetings.getTranscript(meeting.id);
console.log(transcript);

// Summary, decisions, action items, open questions
const extractions = await myntlo.meetings.getExtractions(meeting.id);
console.log('Summary:', extractions.summary);
console.log('Decisions:', extractions.decisions);
console.log('Action items:', extractions.actionItems);
console.log('Open questions:', extractions.openQuestions);
```

## Listing action items

```ts
// Paginated list
const page = await myntlo.actionItems.list({ page: 1, perPage: 25 });
console.log(page.data, page.total);

// Iterate all action items without manual pagination
for await (const item of myntlo.actionItems.iterate()) {
  console.log(item.task, item.status, item.assignedToName);
}
```

## Managing action items

```ts
// Create a new action item
const item = await myntlo.actionItems.create({
  meetingId: meeting.id,
  task: 'Follow up with legal team',
  assignedToName: 'Alice',
  dueDate: '2026-06-01',
});

// Mark as done
await myntlo.actionItems.markDone(item.id);

// Update fields
await myntlo.actionItems.update(item.id, {
  task: 'Follow up with legal and finance teams',
  dueDate: '2026-06-15',
});

// Delete
await myntlo.actionItems.delete(item.id);
```

## Searching decisions

```ts
// Simple query string
const results = await myntlo.decisions.search('infrastructure migration', {
  page: 1,
  perPage: 10,
});
console.log(results.data);

// Or pass an options object
const results2 = await myntlo.decisions.search({
  query: 'infrastructure migration',
  page: 1,
  perPage: 10,
});
```

## Listing decisions

```ts
const decisions = await myntlo.decisions.list({ page: 1, perPage: 20 });

for (const decision of decisions.data) {
  console.log(decision.decision, decision.context);
}

// Iterate all decisions
for await (const decision of myntlo.decisions.iterate()) {
  console.log(decision.id, decision.decision);
}
```

## Low-level upload API

```ts
// Create a presigned URL manually
const { uploadId, uploadUrl } = await myntlo.uploads.createPresignedUrl({
  filename: 'meeting.mp3',
  contentType: 'audio/mpeg',
  size: 1048576,
});

// Upload directly to storage
await fetch(uploadUrl, {
  method: 'PUT',
  body: fileBlob,
  headers: { 'Content-Type': 'audio/mpeg' },
});

// Finalize to create the meeting record
const meeting = await myntlo.uploads.complete({
  uploadId,
  title: 'Q3 Planning',
});
```

## Webhook verification

```ts
import { verifyMyntloWebhook } from '@myntlo/sdk';

// In your webhook handler:
const event = await verifyMyntloWebhook({
  payload: request.body,           // raw request body (string or Buffer)
  signature: request.headers['myntlo-signature'],
  secret: process.env.MYNTLO_WEBHOOK_SECRET!,
});

console.log(event.type);  // e.g. "meeting.completed"
console.log(event.data);
```

Or via the static method on `MyntloClient`:

```ts
const event = await MyntloClient.verifyWebhook(payload, signature, secret);
```

## Error handling

```ts
import {
  MyntloAPIError,
  MyntloAuthError,
  MyntloNotFoundError,
  MyntloRateLimitError,
  MyntloTimeoutError,
  MyntloValidationError,
} from '@myntlo/sdk';

try {
  const meeting = await myntlo.meetings.waitUntilDone('meeting_123');
} catch (error) {
  if (error instanceof MyntloAuthError) {
    console.error('Invalid API key — check MYNTLO_API_KEY.');
  } else if (error instanceof MyntloNotFoundError) {
    console.error('Meeting not found.');
  } else if (error instanceof MyntloRateLimitError) {
    console.error('Rate limited — retry with backoff.');
  } else if (error instanceof MyntloTimeoutError) {
    console.error('Processing timed out.');
  } else if (error instanceof MyntloAPIError) {
    console.error('API error:', error.message, error.statusCode);
  }
}
```

## TypeScript types

The SDK ships full TypeScript types. Import them directly:

```ts
import type {
  Meeting,
  MeetingStatus,
  ProcessingStage,
  MeetingExtraction,
  Decision,
  ActionItem,
  ActionItemStatus,
  ListResponse,
  WebhookEvent,
} from '@myntlo/sdk';
```

## API reference

### Client

```ts
new MyntloClient({
  apiKey: string;           // required
  baseUrl?: string;         // default: 'https://api.myntlo.co/v1'
  timeoutMs?: number;       // default: 30000
  maxRetries?: number;      // default: 3
});
```

### Meetings

```ts
myntlo.meetings.list(options?: ListOptions): Promise<ListResponse<Meeting>>
myntlo.meetings.get(id: string): Promise<Meeting>
myntlo.meetings.getStatus(id: string): Promise<MeetingStatusResponse>
myntlo.meetings.update(id: string, data: MeetingUpdateInput): Promise<Meeting>
myntlo.meetings.delete(id: string): Promise<void>
myntlo.meetings.export(id: string, { format: MeetingExportFormat }): Promise<string>
myntlo.meetings.upload(input: UploadInput): Promise<Meeting>
myntlo.meetings.uploadFile(input: NodeUploadInput): Promise<Meeting>
myntlo.meetings.waitUntilDone(id: string, options?: WaitUntilDoneOptions): Promise<Meeting>
myntlo.meetings.getTranscript(id: string): Promise<MeetingTranscript>
myntlo.meetings.getExtractions(id: string): Promise<MeetingExtractions>
myntlo.meetings.iterate(options?: ListOptions): AsyncIterable<Meeting>
```

### Uploads

```ts
myntlo.uploads.createPresignedUrl(input: PresignedUrlInput): Promise<PresignedUrlResult>
myntlo.uploads.complete(input: UploadCompleteInput): Promise<Meeting>
```

### Action items

```ts
myntlo.actionItems.list(options?: ListOptions): Promise<ListResponse<ActionItem>>
myntlo.actionItems.get(id: string): Promise<ActionItem>
myntlo.actionItems.create(data: ActionItemCreateInput): Promise<ActionItem>
myntlo.actionItems.update(id: string, data: ActionItemUpdateInput): Promise<ActionItem>
myntlo.actionItems.updateStatus(id: string, status: ActionItemStatus): Promise<ActionItem>
myntlo.actionItems.markDone(id: string): Promise<ActionItem>
myntlo.actionItems.delete(id: string): Promise<void>
myntlo.actionItems.iterate(options?: ListOptions): AsyncIterable<ActionItem>
```

### Decisions

```ts
myntlo.decisions.list(options?: ListOptions): Promise<ListResponse<Decision>>
myntlo.decisions.get(id: string): Promise<Decision>
myntlo.decisions.search(query: string, options?: ListOptions): Promise<ListResponse<Decision>>
myntlo.decisions.search(options: DecisionSearchOptions): Promise<ListResponse<Decision>>
myntlo.decisions.iterate(options?: ListOptions): AsyncIterable<Decision>
```

### Organizations

```ts
myntlo.organizations.get(): Promise<Organization>
myntlo.organizations.listMembers(options?: ListOptions): Promise<ListResponse<Member>>
```

## Docs

See the full API documentation at https://docs.myntlo.co.
