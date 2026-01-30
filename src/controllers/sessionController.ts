import type { Request, Response, NextFunction } from 'express';
import db from '../services/dbService.js';
import type { AuthRequest } from '../middleware/authMiddleware.js';

export class SessionController {

    /**
     * Abre uma nova sessão (Cliente escaneou o QR Code).
     */
    static async open(req: Request, res: Response, next: NextFunction) {
        const client = await db.getClient();
        try {
            const { idMesa } = req.body;
            // Pega o ID do usuário do token (pode ser cliente logado ou guest)
            const userId = (req as AuthRequest).user?.id;

            if (!idMesa) {
                return res.status(400).json({ success: false, message: 'Informe o idMesa.' });
            }

            await client.query('BEGIN');

            // 1. Descobrir de qual restaurante é essa mesa
            const mesaResult = await client.query(
                `SELECT id_restaurante, ativa FROM mesas WHERE id_mesa = $1`,
                [idMesa]
            );

            if (mesaResult.rows.length === 0) {
                throw new Error('Mesa não encontrada.');
            }

            const { id_restaurante, ativa } = mesaResult.rows[0];

            if (!ativa) {
                throw new Error('Esta mesa está desativada.');
            }

            // 2. Verificar se a mesa JÁ ESTÁ OCUPADA (Sessão Aberta ou Em Andamento)
            const checkBusy = await client.query(
                `SELECT id_sessao FROM sessoes 
                 WHERE id_mesa = $1 AND status IN ('ABERTA', 'EM_ANDAMENTO')`,
                [idMesa]
            );

            if (checkBusy.rows.length > 0) {
                // Se já tem sessão aberta, retornamos ela em vez de erro (UX melhor)
                // Assim o cliente "entra" na mesa que já estava aberta.
                await client.query('COMMIT');
                return res.json({
                    success: true,
                    message: 'Você entrou em uma sessão existente.',
                    idSessao: checkBusy.rows[0].id_sessao,
                    isNew: false
                });
            }

            // 3. Criar a Nova Sessão
            const insertQuery = `
                INSERT INTO sessoes (id_restaurante, id_mesa, id_usuario_criador, origem, status)
                VALUES ($1, $2, $3, 'QRCODE', 'ABERTA')
                RETURNING id_sessao
            `;

            const sessionResult = await client.query(insertQuery, [
                id_restaurante,
                idMesa,
                userId // O banco exige um usuário criador (logado ou guest)
            ]);

            await client.query('COMMIT');

            res.status(201).json({
                success: true,
                message: 'Mesa aberta com sucesso!',
                idSessao: sessionResult.rows[0].id_sessao,
                isNew: true
            });

        } catch (error) {
            await client.query('ROLLBACK');
            next(error);
        } finally {
            client.release();
        }
    }
}