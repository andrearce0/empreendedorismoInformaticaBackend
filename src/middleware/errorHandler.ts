import type { Request, Response, NextFunction } from 'express';

/**
 * Centralized error handler middleware.
 * Captures all errors thrown in the application and returns a consistent JSON response.
 */
export const errorHandler = (
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    console.error(`[Error] ${err.stack || err.message}`);

    const status = err.status || 500;
    const message = err.message || 'Internal Server Error';

    res.status(status).json({
        success: false,
        status,
        message,
        // stack only in development if needed
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
};
