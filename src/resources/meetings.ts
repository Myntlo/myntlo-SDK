import type {
  ListOptions,
  ListResponse,
  Meeting,
  MeetingExportFormat,
  MeetingExtractions,
  MeetingStatusResponse,
  MeetingTranscript,
  PaginationIteratorOptions,
  PresignedUrlResult,
  UploadInput,
  Uploadable,
} from '../types';
import type { MyntloClient } from '../client';
import { MyntloAPIError, MyntloTimeoutError } from '../errors';

export type WaitUntilDoneOptions = {
  pollIntervalMs?: number;
  timeoutMs?: number;
};

export type MeetingUpdateInput = {
  title?: string;
  participantEmails?: string[];
};

export type NodeUploadInput = {
  path: string;
  title?: string;
  participantEmails?: string[];
};

const MIME_TYPES: Record<string, string> = {
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
  webm: 'audio/webm',
  ogg: 'audio/ogg',
  flac: 'audio/flac',
  aac: 'audio/aac',
};

export class MeetingsResource {
  constructor(private readonly client: MyntloClient) {}

  list(options: ListOptions = {}): Promise<ListResponse<Meeting>> {
    return this.client.request('GET', '/meetings', { query: options });
  }

  get(id: string): Promise<Meeting> {
    return this.client.request('GET', `/meetings/${encodeURIComponent(id)}`);
  }

  getStatus(id: string): Promise<MeetingStatusResponse> {
    return this.client.request('GET', `/meetings/${encodeURIComponent(id)}/status`);
  }

  update(id: string, data: MeetingUpdateInput): Promise<Meeting> {
    return this.client.request('PATCH', `/meetings/${encodeURIComponent(id)}`, { body: data });
  }

  delete(id: string): Promise<void> {
    return this.client.request('DELETE', `/meetings/${encodeURIComponent(id)}`);
  }

  export(id: string, options: { format: MeetingExportFormat }): Promise<string> {
    return this.client.request('GET', `/meetings/${encodeURIComponent(id)}/export`, {
      query: { format: options.format },
    });
  }

  /**
   * Upload a meeting file directly using the client.
   * @remarks Server-side only. This sends your full API key with every
   * request. Never call this from browser/client-side code. For browser
   * uploads, mint a presigned URL server-side via
   * `client.uploads.createPresignedUrl(...)` and PUT to it from the browser.
   */
  async upload(input: UploadInput): Promise<Meeting> {
    const { file, title, participantEmails } = input;
    const filename = file instanceof File ? file.name : 'upload';
    const contentType = file instanceof File && file.type ? file.type : 'audio/mpeg';
    const size = file instanceof Blob ? file.size : undefined;

    const presigned = await this.client.request<PresignedUrlResult>('POST', '/uploads/presign', {
      body: { filename, contentType, size },
    });

    const blob = await toBlob(file);
    await fetch(presigned.uploadUrl, {
      method: 'PUT',
      body: blob,
      headers: { 'Content-Type': contentType },
    });

    return this.client.request<Meeting>('POST', '/uploads/complete', {
      body: { uploadId: presigned.uploadId, title, participantEmails },
    });
  }

  /**
   * Upload a meeting file from a local path (Node.js only).
   * @remarks Server-side only. Uses `node:fs` and sends your full API key
   * with every request.
   */
  async uploadFile(input: NodeUploadInput): Promise<Meeting> {
    const { readFile } = await import('node:fs/promises');
    const { basename } = await import('node:path');

    const buffer = await readFile(input.path);
    const filename = basename(input.path);
    const ext = filename.split('.').pop()?.toLowerCase() ?? '';
    const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';

    const presigned = await this.client.request<PresignedUrlResult>('POST', '/uploads/presign', {
      body: { filename, contentType, size: buffer.byteLength },
    });

    await fetch(presigned.uploadUrl, {
      method: 'PUT',
      body: new Blob([new Uint8Array(buffer)]),
      headers: { 'Content-Type': contentType },
    });

    return this.client.request<Meeting>('POST', '/uploads/complete', {
      body: {
        uploadId: presigned.uploadId,
        title: input.title,
        participantEmails: input.participantEmails,
      },
    });
  }

  async waitUntilDone(id: string, options: WaitUntilDoneOptions = {}): Promise<Meeting> {
    const pollIntervalMs = options.pollIntervalMs ?? 3000;
    const timeoutMs = options.timeoutMs ?? 600000;
    const deadline = Date.now() + timeoutMs;

    while (true) {
      const statusResponse = await this.getStatus(id);

      if (statusResponse.status === 'done') {
        return this.get(id);
      }

      if (statusResponse.status === 'failed') {
        throw new MyntloAPIError({
          message: `Meeting ${id} processing failed.`,
        });
      }

      if (Date.now() + pollIntervalMs > deadline) {
        throw new MyntloTimeoutError({
          message: `Meeting ${id} did not complete within ${timeoutMs}ms.`,
        });
      }

      await sleep(pollIntervalMs);
    }
  }

  getTranscript(id: string): Promise<MeetingTranscript> {
    return this.client.request('GET', `/meetings/${encodeURIComponent(id)}/transcript`);
  }

  getExtractions(id: string): Promise<MeetingExtractions> {
    return this.client.request('GET', `/meetings/${encodeURIComponent(id)}/extractions`);
  }

  async *iterate(options: PaginationIteratorOptions = {}): AsyncGenerator<Meeting> {
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function toBlob(file: Uploadable): Promise<Blob> {
  if (file instanceof Blob) {
    return file;
  }
  if (file instanceof ArrayBuffer) {
    return new Blob([file]);
  }
  if (file instanceof Uint8Array) {
    return new Blob([ensureArrayBuffer(file)]);
  }

  const chunks: Uint8Array<ArrayBuffer>[] = [];

  if (file instanceof ReadableStream) {
    const reader = file.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(ensureArrayBuffer(value));
    }
  } else if (isAsyncIterable(file)) {
    for await (const chunk of file) {
      chunks.push(ensureArrayBuffer(chunk));
    }
  }

  return new Blob(chunks);
}

function isAsyncIterable(value: unknown): value is AsyncIterable<Uint8Array> {
  return typeof (value as AsyncIterable<Uint8Array>)?.[Symbol.asyncIterator] === 'function';
}

function ensureArrayBuffer(value: Uint8Array): Uint8Array<ArrayBuffer> {
  if (value.buffer instanceof ArrayBuffer) {
    return value as Uint8Array<ArrayBuffer>;
  }
  return new Uint8Array(value) as Uint8Array<ArrayBuffer>;
}
