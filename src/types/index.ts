import type { ActionItemStatus } from './actionItem';

export type ListOptions = {
  page?: number;
  perPage?: number;
  cursor?: string;
};

export type ListResponse<T> = {
  data: T[];
  total: number;
  page: number;
  perPage: number;
  hasMore: boolean;
};

export type UploadProgress = {
  loaded: number;
  total?: number;
  percent?: number;
};

export type UploadMeetingOptions = {
  title?: string;
  participantEmails?: string[];
  onProgress?: (progress: UploadProgress) => void;
};

export type PaginationIteratorOptions = ListOptions;

export type WebhookEventType =
  | 'meeting.processing'
  | 'meeting.completed'
  | 'meeting.failed'
  | 'action_item.updated';

export type WebhookEvent<T = unknown> = {
  id: string;
  type: WebhookEventType;
  createdAt: string;
  data: T;
};

export type Uploadable =
  | Blob
  | File
  | ArrayBuffer
  | Uint8Array
  | ReadableStream<Uint8Array>
  | AsyncIterable<Uint8Array>;

export type DecisionSearchOptions = {
  query: string;
  page?: number;
  perPage?: number;
};

export type ActionItemUpdateStatusRequest = {
  status: ActionItemStatus;
};

export * from './meeting';
export * from './decision';
export * from './actionItem';
export * from './organization';

export type UploadProgress = {
  loaded: number;
  total?: number;
  percent?: number;
};

export type UploadMeetingOptions = {
  title?: string;
  participantEmails?: string[];
  onProgress?: (progress: UploadProgress) => void;
};

export type PaginationIteratorOptions = ListOptions;

export type WebhookEventType =
  | 'meeting.processing'
  | 'meeting.completed'
  | 'meeting.failed'
  | 'action_item.updated';

export type WebhookEvent<T = unknown> = {
  id: string;
  type: WebhookEventType;
  createdAt: string;
  data: T;
};

export type Uploadable =
  | Blob
  | File
  | ArrayBuffer
  | Uint8Array
  | ReadableStream<Uint8Array>
  | AsyncIterable<Uint8Array>;

export type DecisionSearchOptions = {
  query: string;
  page?: number;
  perPage?: number;
};

export type ActionItemUpdateStatusRequest = {
  status: ActionItemStatus;
};
