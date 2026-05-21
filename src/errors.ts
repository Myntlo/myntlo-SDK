export type MyntloErrorOptions = {
  message: string;
  statusCode?: number;
  code?: string;
  requestId?: string | null;
  rawResponse?: unknown;
  details?: unknown;
};

export class MyntloError extends Error {
  readonly statusCode?: number;
  readonly code?: string;
  readonly requestId?: string | null;
  readonly rawResponse?: unknown;
  readonly details?: unknown;

  constructor(options: MyntloErrorOptions) {
    super(options.message);
    this.name = 'MyntloError';
    this.statusCode = options.statusCode;
    this.code = options.code;
    this.requestId = options.requestId;
    this.rawResponse = options.rawResponse;
    this.details = options.details;
  }

  isRetryable(): boolean {
    return false;
  }
}

export class MyntloAPIError extends MyntloError {
  constructor(options: MyntloErrorOptions) {
    super(options);
    this.name = 'MyntloAPIError';
  }

  isRetryable(): boolean {
    return this.statusCode !== undefined && this.statusCode >= 500;
  }
}

export class MyntloAuthError extends MyntloError {
  constructor(options: MyntloErrorOptions) {
    super(options);
    this.name = 'MyntloAuthError';
  }
}

export class MyntloRateLimitError extends MyntloError {
  constructor(options: MyntloErrorOptions) {
    super(options);
    this.name = 'MyntloRateLimitError';
  }

  isRetryable(): boolean {
    return true;
  }
}

export class MyntloNotFoundError extends MyntloError {
  constructor(options: MyntloErrorOptions) {
    super(options);
    this.name = 'MyntloNotFoundError';
  }
}

export class MyntloTimeoutError extends MyntloError {
  constructor(options: MyntloErrorOptions) {
    super(options);
    this.name = 'MyntloTimeoutError';
  }

  isRetryable(): boolean {
    return true;
  }
}

export class MyntloValidationError extends MyntloError {
  constructor(options: MyntloErrorOptions) {
    super(options);
    this.name = 'MyntloValidationError';
  }
}
