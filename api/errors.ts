/**
 * 统一错误类型定义
 */

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function handleError(error: unknown): { code: string; message: string; statusCode: number } {
  if (isAppError(error)) {
    return { code: error.code, message: error.message, statusCode: error.statusCode };
  }
  if (error instanceof Error) {
    return { code: ErrorCodes.INTERNAL_ERROR, message: error.message, statusCode: 500 };
  }
  return { code: ErrorCodes.INTERNAL_ERROR, message: 'Unknown error', statusCode: 500 };
}

export interface SuccessResponse<T = unknown> {
  code: 0;
  data: T;
  message?: string;
}

export interface ErrorResponse {
  code: string | number;
  message: string;
  data?: unknown;
}

export type ApiResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;

export function success<T>(data: T, message?: string): SuccessResponse<T> {
  const res: SuccessResponse<T> = { code: 0, data };
  if (message) res.message = message;
  return res;
}

export function error(code: string | number, message: string, data?: unknown): ErrorResponse {
  const res: ErrorResponse = { code, message };
  if (data !== undefined) res.data = data;
  return res;
}
