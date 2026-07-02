/**
 * 统一错误类型定义
 */
export class AppError extends Error {
    code;
    statusCode;
    constructor(code, message, statusCode = 400) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
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
};
export function isAppError(error) {
    return error instanceof AppError;
}
export function handleError(error) {
    if (isAppError(error)) {
        return { code: error.code, message: error.message, statusCode: error.statusCode };
    }
    if (error instanceof Error) {
        return { code: ErrorCodes.INTERNAL_ERROR, message: error.message, statusCode: 500 };
    }
    return { code: ErrorCodes.INTERNAL_ERROR, message: 'Unknown error', statusCode: 500 };
}
export function success(data, message) {
    const res = { code: 0, data };
    if (message)
        res.message = message;
    return res;
}
export function error(code, message, data) {
    const res = { code, message };
    if (data !== undefined)
        res.data = data;
    return res;
}
