export class SepError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: string = 'error',
    status: number = 400,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SepError';
    this.code = code;
    this.status = status;
    this.details = details;
    Object.setPrototypeOf(this, SepError.prototype);
  }

  toJSON(): Record<string, unknown> {
    return {
      error: this.message,
      code: this.code,
      ...this.details,
    };
  }
}

export function badRequest(
  message: string,
  code: string = 'bad_request',
  details?: Record<string, unknown>
): SepError {
  return new SepError(message, code, 400, details);
}

export function unauthorized(
  message: string = 'Unauthorized',
  details?: Record<string, unknown>
): SepError {
  return new SepError(message, 'unauthorized', 401, details);
}

export function forbidden(
  message: string = 'Forbidden',
  details?: Record<string, unknown>
): SepError {
  return new SepError(message, 'forbidden', 403, details);
}

export function notFound(
  message: string = 'Not found',
  details?: Record<string, unknown>
): SepError {
  return new SepError(message, 'not_found', 404, details);
}

export function conflict(
  message: string = 'Conflict',
  details?: Record<string, unknown>
): SepError {
  return new SepError(message, 'conflict', 409, details);
}
