import {
  MyntloAPIError,
  MyntloAuthError,
  MyntloNotFoundError,
  MyntloRateLimitError,
  MyntloTimeoutError,
} from './errors';
import type { WebhookEvent } from './types';
import { computeHmacSHA256, timingSafeEqualHex } from './internal/webhookCrypto';
import { ActionItemsResource } from './resources/actionItems';
import { DecisionsResource } from './resources/decisions';
import { MeetingsResource } from './resources/meetings';
import { OrganizationsResource } from './resources/organizations';
import { UploadsResource } from './resources/uploads';

export type MyntloClientOptions = {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
};

export type RequestOptions = {
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
  signal?: AbortSignal;
};

export class MyntloClient {
  readonly meetings: MeetingsResource;
  readonly decisions: DecisionsResource;
  readonly actionItems: ActionItemsResource;
  readonly organizations: OrganizationsResource;
  readonly uploads: UploadsResource;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(options: MyntloClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? 'https://api.myntlo.co/v1';
    this.timeoutMs = options.timeoutMs ?? 30000;
    this.maxRetries = options.maxRetries ?? 3;

    this.meetings = new MeetingsResource(this);
    this.decisions = new DecisionsResource(this);
    this.actionItems = new ActionItemsResource(this);
    this.organizations = new OrganizationsResource(this);
    this.uploads = new UploadsResource(this);
  }

  /** Verify a webhook signature and parse the event payload. */
  static async verifyWebhook<T = WebhookEvent>(
    payload: string | Uint8Array,
    signature: string,
    secret: string,
  ): Promise<T> {
    const payloadBytes = typeof payload === 'string' ? new TextEncoder().encode(payload) : payload;
    const expected = await computeHmacSHA256(payloadBytes, secret);
    const isValid = await timingSafeEqualHex(expected, signature);

    if (!isValid) {
      throw new MyntloAuthError({
        message: 'Invalid webhook signature.',
        statusCode: 401,
      });
    }

    const payloadText = typeof payload === 'string' ? payload : new TextDecoder().decode(payload);
    return JSON.parse(payloadText) as T;
  }

  /** Perform a request against the Myntlo API. */
  async request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
    const url = this.resolveUrl(path, options.query);
    const headers = new Headers(options.headers ?? {});

    headers.set('Authorization', `Bearer ${this.apiKey}`);
    headers.set('Accept', 'application/json');

    const bodyInfo = normalizeBody(options.body, headers);

    const timeoutMs = options.timeoutMs ?? this.timeoutMs;
    const signals = [options.signal, createTimeoutSignal(timeoutMs)];
    const signal = mergeAbortSignals(signals);

    let attempt = 0;

    while (attempt <= this.maxRetries) {
      const response = await fetch(url, {
        method,
        headers,
        body: bodyInfo.body,
        signal,
      }).catch((error: unknown) => {
        if (isAbortError(error)) {
          throw new MyntloTimeoutError({
            message: `Request timed out after ${timeoutMs}ms.`,
          });
        }
        throw new MyntloAPIError({
          message: 'Network error while calling Myntlo API.',
          rawResponse: error,
        });
      });

      if (response.ok) {
        return parseResponse<T>(response);
      }

      const error = await createErrorFromResponse(response);
      if (shouldRetry(error) && attempt < this.maxRetries) {
        await sleep(getRetryDelay(attempt, error));
        attempt += 1;
        continue;
      }

      throw error;
    }

    throw new MyntloAPIError({ message: 'Request failed after retries.' });
  }

  /** Resolve a path and query into a full API URL. */
  resolveUrl(path: string, query?: Record<string, string | number | boolean | undefined>): string {
    const baseUrl = this.baseUrl.endsWith('/') ? this.baseUrl : `${this.baseUrl}/`;
    const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
    const url = new URL(normalizedPath, baseUrl);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }
    return url.toString();
  }

  /** Return the API key used by this client. */
  getApiKey(): string {
    return this.apiKey;
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return (await response.json()) as T;
  }

  const text = await response.text();
  return text as T;
}

function normalizeBody(body: unknown, headers: Headers): { body?: BodyInit } {
  if (body === undefined || body === null) {
    return {};
  }

  if (body instanceof FormData) {
    return { body };
  }

  if (
    typeof body === 'string' ||
    body instanceof Blob ||
    body instanceof ArrayBuffer ||
    body instanceof Uint8Array ||
    body instanceof ReadableStream
  ) {
    return { body: body as BodyInit };
  }

  headers.set('Content-Type', 'application/json');
  return { body: JSON.stringify(body) };
}

async function createErrorFromResponse(response: Response) {
  const requestId = response.headers.get('x-request-id') ?? response.headers.get('request-id');
  const raw = await parseErrorBody(response);
  const message =
    (raw && typeof raw === 'object' && 'message' in raw
      ? String((raw as { message?: string }).message)
      : response.statusText) || 'Request failed.';

  if (response.status === 401) {
    return new MyntloAuthError({
      message,
      statusCode: response.status,
      requestId,
      rawResponse: raw,
    });
  }

  if (response.status === 404) {
    return new MyntloNotFoundError({
      message,
      statusCode: response.status,
      requestId,
      rawResponse: raw,
    });
  }

  if (response.status === 429) {
    return new MyntloRateLimitError({
      message,
      statusCode: response.status,
      requestId,
      rawResponse: raw,
      retryAfterSeconds: parseRetryAfter(response.headers.get('retry-after')),
    });
  }

  return new MyntloAPIError({
    message,
    statusCode: response.status,
    requestId,
    rawResponse: raw,
  });
}

async function parseErrorBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  return response.text();
}

function shouldRetry(error: unknown): boolean {
  if (error instanceof MyntloRateLimitError) {
    return true;
  }
  if (error instanceof MyntloAPIError) {
    return error.isRetryable();
  }
  return false;
}

function getRetryDelay(attempt: number, error?: unknown): number {
  if (error instanceof MyntloRateLimitError && error.retryAfterSeconds !== undefined) {
    return error.retryAfterSeconds * 1000;
  }
  const base = 500;
  const jitter = Math.floor(Math.random() * 100);
  return base * Math.pow(2, attempt) + jitter;
}

// Retry-After is either a number of seconds or an HTTP-date (RFC 7231).
function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds;
  }

  const dateMs = Date.parse(value);
  if (!Number.isNaN(dateMs)) {
    return Math.max(0, Math.round((dateMs - Date.now()) / 1000));
  }

  return undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAbortError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && (error as { name?: string }).name === 'AbortError');
}

function createTimeoutSignal(timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  controller.signal.addEventListener('abort', () => clearTimeout(timeout), { once: true });
  return controller.signal;
}

function mergeAbortSignals(signals: Array<AbortSignal | undefined>): AbortSignal {
  const controller = new AbortController();

  const onAbort = () => {
    if (!controller.signal.aborted) {
      controller.abort();
    }
  };

  for (const signal of signals) {
    if (!signal) {
      continue;
    }
    if (signal.aborted) {
      controller.abort();
      break;
    }
    signal.addEventListener('abort', onAbort, { once: true });
  }

  return controller.signal;
}
