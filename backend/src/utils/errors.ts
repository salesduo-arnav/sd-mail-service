import { NextFunction, Request, Response } from 'express';
import Logger from './logger';

/** Typed application error carrying an HTTP status + optional machine code. */
export class AppError extends Error {
    public readonly status: number;
    public readonly code: string;
    public readonly details?: unknown;

    constructor(status: number, message: string, code = 'error', details?: unknown) {
        super(message);
        this.name = 'AppError';
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

export const badRequest = (msg: string, code = 'bad_request', details?: unknown) =>
    new AppError(400, msg, code, details);
export const unauthorized = (msg = 'Unauthorized', code = 'unauthorized') => new AppError(401, msg, code);
export const forbidden = (msg = 'Forbidden', code = 'forbidden') => new AppError(403, msg, code);
export const notFound = (msg = 'Not found', code = 'not_found') => new AppError(404, msg, code);
export const conflict = (msg: string, code = 'conflict') => new AppError(409, msg, code);
export const serviceUnavailable = (msg = 'Service unavailable', code = 'service_unavailable') =>
    new AppError(503, msg, code);

/** Express error-handling middleware (mounted last). */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
    if (err instanceof AppError) {
        if (err.status >= 500) Logger.error(err.message, { code: err.code, path: req.path, details: err.details });
        return res.status(err.status).json({ error: err.code, message: err.message, details: err.details });
    }
    const message = err instanceof Error ? err.message : 'Internal server error';
    Logger.error('Unhandled error', { message, path: req.path });
    return res.status(500).json({ error: 'internal_error', message: 'Internal server error' });
}

/** Wrap an async route handler so thrown errors reach the error middleware. */
export const asyncHandler =
    (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
    (req: Request, res: Response, next: NextFunction) =>
        Promise.resolve(fn(req, res, next)).catch(next);
