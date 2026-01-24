import type { Request, Response, NextFunction } from 'express';

/**
 Realiza a captura de erros e retorna uma resposta padronizada.
 */
export const errorHandler = (
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    //Log do erro no terminal
    console.error(`[Error] ${err.stack || err.message}`);

    //Determina o Status Code
    let status = err.status || 500;
    const message = err.message || 'Internal Server Error';

    if (status === 500) {
        if (message.includes('Forbidden') || message.includes('permissão') || message.includes('não tem permissão')) {
            status = 403;
        }
        else if (message.includes('Unauthorized') || message.includes('não autenticado') || message.includes('Token')) {
            status = 401;
        }
    }

    //Resposta ao cliente
    res.status(status).json({
        success: false,
        status,
        message,
        stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
    });
};