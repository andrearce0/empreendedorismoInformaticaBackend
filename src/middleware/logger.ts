import type { Request, Response, NextFunction } from 'express';

/**
 * Simple request logger middleware.
 */
export const logger = (req: Request, res: Response, next: NextFunction) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.url}`);
    next();
};
