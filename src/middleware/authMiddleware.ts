import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export interface UserPayload {
    id: number;
    email: string;
    roles: string[];
}

export interface AuthRequest extends Request {
    user?: UserPayload;
}

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    // 1. Verifica se o header existe
    if (!authHeader) {
        return res.status(401).json({ success: false, message: 'Unauthorized: Token não fornecido.' });
    }

    // 2. Extrai o token a partir do header
    const token = authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: 'Unauthorized: Formato do token inválido.' });
    }

    try {
        const decoded = jwt.verify(token, config.jwtSecret) as unknown as UserPayload;

        (req as AuthRequest).user = decoded;

        next();
    } catch (error: any) {
        return res.status(401).json({ success: false, message: 'Unauthorized: Token inválido ou expirado.' });
    }
};

export const authorize = (allowedRoles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = (req as AuthRequest).user;

        if (!user) {
            return res.status(401).json({ success: false, message: 'Unauthorized: Usuário não autenticado.' });
        }

        const hasPermission = user.roles.some((role) => allowedRoles.includes(role));

        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                message: 'Forbidden: Você não tem permissão para acessar este recurso.'
            });
        }

        next();
    };
};