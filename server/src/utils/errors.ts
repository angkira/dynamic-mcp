export class LlmError extends Error {
  statusCode: number;
  code: string | undefined;

  constructor(message: string, statusCode: number, code?: string | null) {
    super(message);
    this.name = 'LlmError';
    this.statusCode = statusCode;
    this.code = code === null ? undefined : code;
  }
}

export class LlmRateLimitError extends LlmError {
  constructor(message = 'Rate limit exceeded', code = 'rate_limit_exceeded') {
    super(message, 429, code);
    this.name = 'LlmRateLimitError';
  }
}

export class LlmAuthError extends LlmError {
  constructor(message = 'Authentication failed', code = 'authentication_failed') {
    super(message, 401, code);
    this.name = 'LlmAuthError';
  }
}

export class LlmBadRequestError extends LlmError {
  constructor(message = 'Bad request', code = 'bad_request') {
    super(message, 400, code);
    this.name = 'LlmBadRequestError';
  }
}

export class LlmInternalError extends LlmError {
  constructor(message = 'Internal LLM error', code = 'internal_error') {
    super(message, 500, code);
    this.name = 'LlmInternalError';
  }
}