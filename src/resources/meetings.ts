import type {
  ListOptions,
  ListResponse,
  Meeting,
  MeetingExtractions,
  MeetingTranscript,
  PaginationIteratorOptions,
  UploadMeetingOptions,
  Uploadable,
} from '../types';
import type { MyntloClient } from '../client';
import { MyntloAPIError } from '../errors';

export class MeetingsResource {
  constructor(private readonly client: MyntloClient) {}

  /** List meetings with pagination. */
  list(options: ListOptions = {}): Promise<ListResponse<Meeting>> {
    return this.client.request('GET', '/meetings', { query: options });
  }

  /** Get a meeting by ID. */
  get(id: string): Promise<Meeting> {
    return this.client.request('GET', `/meetings/${encodeURIComponent(id)}`);
  }

  /** Upload a meeting file with optional metadata. */
  async upload(file: Uploadable, options: UploadMeetingOptions = {}): Promise<Meeting> {
    if (options.onProgress && typeof XMLHttpRequest !== 'undefined') {
      return this.uploadWithXHR(file, options);
    }

    const form = await buildMeetingFormData(file, options);
    return this.client.request('POST', '/meetings/upload', { body: form });
  }

  /** Get the transcript for a meeting. */
  getTranscript(id: string): Promise<MeetingTranscript> {
    return this.client.request('GET', `/meetings/${encodeURIComponent(id)}/transcript`);
  }

  /** Get extractions for a meeting. */
  getExtractions(id: string): Promise<MeetingExtractions> {
    return this.client.request('GET', `/meetings/${encodeURIComponent(id)}/extractions`);
  }

  /** Iterate through all meetings. */
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

  private async uploadWithXHR(file: Uploadable, options: UploadMeetingOptions): Promise<Meeting> {
    const form = await buildMeetingFormData(file, options);
    const url = this.client.resolveUrl('/meetings/upload');
    const apiKey = this.client.getApiKey();

    return new Promise<Meeting>((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open('POST', url, true);
      request.setRequestHeader('Authorization', `Bearer ${apiKey}`);
      request.responseType = 'json';

      request.upload.onprogress = (event: ProgressEvent<EventTarget>) => {
        if (!options.onProgress) {
          return;
        }
        const total = event.lengthComputable ? event.total : undefined;
        const percent = total ? Math.round((event.loaded / total) * 100) : undefined;
        options.onProgress({ loaded: event.loaded, total, percent });
      };

      request.onerror = () => {
        reject(
          new MyntloAPIError({
            message: 'Upload failed due to a network error.',
          }),
        );
      };

      request.onload = () => {
        const status = request.status;
        if (status >= 200 && status < 300) {
          resolve(request.response as Meeting);
          return;
        }
        reject(
          new MyntloAPIError({
            message: request.response?.message ?? 'Upload failed.',
            statusCode: status,
            rawResponse: request.response,
          }),
        );
      };

      request.send(form);
    });
  }
}

async function buildMeetingFormData(
  file: Uploadable,
  options: UploadMeetingOptions,
): Promise<FormData> {
  const form = new FormData();
  const filePart = await normalizeUploadable(file, options.onProgress);
  form.append('file', filePart.body, filePart.filename);

  if (options.title) {
    form.append('title', options.title);
  }

  if (options.participantEmails && options.participantEmails.length > 0) {
    form.append('participantEmails', JSON.stringify(options.participantEmails));
  }

  return form;
}

type NormalizedUpload = {
  body: Blob;
  filename?: string;
};

async function normalizeUploadable(
  file: Uploadable,
  onProgress?: (progress: { loaded: number; total?: number; percent?: number }) => void,
): Promise<NormalizedUpload> {
  if (file instanceof Blob) {
    if (onProgress) {
      onProgress({ loaded: 0, total: file.size, percent: 0 });
      onProgress({ loaded: file.size, total: file.size, percent: 100 });
    }
    return { body: file, filename: isFile(file) ? file.name : undefined };
  }

  if (file instanceof ArrayBuffer) {
    const buffer = new Uint8Array(file);
    if (onProgress) {
      onProgress({ loaded: buffer.byteLength, total: buffer.byteLength, percent: 100 });
    }
    return { body: new Blob([buffer]) };
  }

  if (file instanceof Uint8Array) {
    if (onProgress) {
      onProgress({ loaded: file.byteLength, total: file.byteLength, percent: 100 });
    }
    return { body: new Blob([file]) };
  }

  if (isAsyncIterable(file)) {
    const chunks: Uint8Array[] = [];
    let loaded = 0;
    for await (const chunk of file) {
      chunks.push(chunk);
      loaded += chunk.byteLength;
      if (onProgress) {
        onProgress({ loaded });
      }
    }
    if (onProgress) {
      onProgress({ loaded, total: loaded, percent: 100 });
    }
    return { body: new Blob(chunks) };
  }

  if (file instanceof ReadableStream) {
    const reader = file.getReader();
    const chunks: Uint8Array[] = [];
    let loaded = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (value) {
        chunks.push(value);
        loaded += value.byteLength;
        if (onProgress) {
          onProgress({ loaded });
        }
      }
    }
    if (onProgress) {
      onProgress({ loaded, total: loaded, percent: 100 });
    }
    return { body: new Blob(chunks) };
  }

  return { body: new Blob() };
}

function isAsyncIterable(value: unknown): value is AsyncIterable<Uint8Array> {
  return typeof (value as AsyncIterable<Uint8Array>)?.[Symbol.asyncIterator] === 'function';
}

function isFile(value: Blob): value is File {
  return typeof (value as File).name === 'string';
}
