import type { MyntloClient } from '../client';
import type { Meeting, PresignedUrlInput, PresignedUrlResult, UploadCompleteInput } from '../types';

export class UploadsResource {
  constructor(private readonly client: MyntloClient) {}

  createPresignedUrl(input: PresignedUrlInput): Promise<PresignedUrlResult> {
    return this.client.request('POST', '/uploads/presign', { body: input });
  }

  complete(input: UploadCompleteInput): Promise<Meeting> {
    return this.client.request('POST', '/uploads/complete', { body: input });
  }
}
