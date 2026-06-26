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
