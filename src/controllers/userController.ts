import type { Request, Response, NextFunction } from 'express';
import db from '../services/dbService.js';
import type { AuthRequest } from '../middleware/authMiddleware.js';

/**
 * Controller for User related operations.
 */
export class UserController {
    /**
     * List all active users.
     */
    static async getAll(req: Request, res: Response, next: NextFunction) {
        try {
            const result = await db.query(
                `SELECT u.id_usuario as id, u.nome_completo as "fullName", u.email, u.telefone as phone,
                        COALESCE(
                            json_agg(p.nome) FILTER (WHERE p.nome IS NOT NULL),
                            '[]'
                        ) as roles
                 FROM usuarios u
                 LEFT JOIN usuarios_papeis up ON u.id_usuario = up.id_usuario
                 LEFT JOIN papeis p ON up.id_papel = p.id_papel
                 WHERE u.ativo = true
                 GROUP BY u.id_usuario`
            );
            res.json({ success: true, data: result.rows });
        } catch (error) {
            next(error);
        }
    }

    static async getProfile(req: Request, res: Response, next: NextFunction) {
        try {
            // O cast (as AuthRequest) permite acessar o .user com segurança
            const userId = (req as AuthRequest).user?.id;

            if (!userId) {
                return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
            }

            // Busca os dados no banco (excluindo a senha por segurança)
            const result = await db.query(
                `SELECT id_usuario, nome_completo, email, telefone, criado_em 
                 FROM usuarios 
                 WHERE id_usuario = $1`,
                [userId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
            }

            res.json({
                success: true,
                data: result.rows[0]
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get a specific user by ID.
     */
    static async getById(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const result = await db.query(
                `SELECT u.id_usuario as id, u.nome_completo as "fullName", u.email, u.telefone as phone,
                        COALESCE(
                            json_agg(p.nome) FILTER (WHERE p.nome IS NOT NULL),
                            '[]'
                        ) as roles
                 FROM usuarios u
                 LEFT JOIN usuarios_papeis up ON u.id_usuario = up.id_usuario
                 LEFT JOIN papeis p ON up.id_papel = p.id_papel
                 WHERE u.id_usuario = $1
                 GROUP BY u.id_usuario`,
                [Number(id)]
            );

            const user = result.rows[0];

            if (!user) {
                return res.status(404).json({ success: false, message: 'User not found' });
            }

            res.json({ success: true, data: user });
        } catch (error) {
            next(error);
        }
    }
}
