export type ErrorCode =
  | "VALIDATION"
  | "NOT_FOUND"
  | "CONFLICT"
  | "PROVIDER"
  | "QUOTA"
  | "STORAGE"
  | "INTERNAL"
  | "UNAVAILABLE";

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly details?: Record<string, unknown>;
  override readonly cause?: unknown;

  constructor(
    code: ErrorCode,
    message: string,
    options?: { details?: Record<string, unknown>; cause?: unknown },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "AppError";
    this.code = code;
    this.details = options?.details;
  }
}

export function validationError(message: string, details?: Record<string, unknown>): AppError {
  return new AppError("VALIDATION", message, { details });
}

export function notFoundError(message: string, details?: Record<string, unknown>): AppError {
  return new AppError("NOT_FOUND", message, { details });
}

export function providerError(message: string, details?: Record<string, unknown>): AppError {
  return new AppError("PROVIDER", message, { details });
}

export function quotaError(message: string, details?: Record<string, unknown>): AppError {
  return new AppError("QUOTA", message, { details });
}

export function storageError(message: string, details?: Record<string, unknown>): AppError {
  return new AppError("STORAGE", message, { details });
}

export function internalError(message: string, cause?: unknown): AppError {
  return new AppError("INTERNAL", message, { cause });
}
