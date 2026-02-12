import * as db from '../config/db.js';

export class SessionController {

    /**
     * Abre uma sessão (Cliente escaneou QR Code)
     */
    static async openSession(req, res) {
        const client = await db.getClient();
        try {
            const { idMesa } = req.body;
            const userId = req.user.id;

            console.log(`[DEBUG] Tentando abrir sessão. Mesa: ${idMesa}, User: ${userId}`);

            if (!idMesa) return res.status(400).json({ error: 'ID da mesa obrigatório.' });

            await client.query('BEGIN');

            // 1. Verificar se a mesa existe
            // IMPORTANTE: Selecionamos explicitamente a coluna id_restaurante
            const tableCheck = await client.query(
                'SELECT id_restaurante FROM mesas WHERE id_mesa = $1',
                [idMesa]
            );

            if (tableCheck.rows.length === 0) {
                console.error('[DEBUG] Mesa não encontrada no banco.');
                throw new Error('Mesa não encontrada.');
            }

            // [DEBUG] Vamos ver o que o banco devolveu
            console.log('[DEBUG] Resultado da consulta da mesa:', tableCheck.rows[0]);

            // Tenta pegar o ID (garantindo que não seja undefined)
            const restaurantId = tableCheck.rows[0].id_restaurante;

            if (!restaurantId) {
                console.error('[DEBUG] ID do restaurante veio NULO da tabela de mesas!');
                throw new Error('Inconsistência: Esta mesa não está vinculada a um restaurante.');
            }

            // 2. Verificar se a mesa JÁ ESTÁ OCUPADA
            const checkBusy = await client.query(
                `SELECT id_sessao FROM sessoes 
                 WHERE id_mesa = $1 AND status = 'ABERTA'`,
                [idMesa]
            );

            if (checkBusy.rows.length > 0) {
                await client.query('COMMIT');
                console.log('[DEBUG] Mesa já ocupada. Entrando na sessão existente.');
                return res.json({
                    success: true,
                    message: 'Você entrou em uma sessão existente.',
                    idSessao: checkBusy.rows[0].id_sessao,
                    isNew: false
                });
            }

            // 3. Criar a sessão
            console.log(`[DEBUG] Inserindo sessão para Restaurante: ${restaurantId}, Mesa: ${idMesa}, User: ${userId}`);

            const newSession = await client.query(
                `INSERT INTO sessoes (id_restaurante, id_mesa, id_usuario_criador, origem, status)
                 VALUES ($1, $2, $3, 'QRCODE', 'ABERTA')
                 RETURNING id_sessao`,
                [restaurantId, idMesa, userId]
            );

            await client.query('COMMIT');
            console.log('[DEBUG] Sessão criada com sucesso:', newSession.rows[0].id_sessao);

            res.status(201).json({
                success: true,
                message: 'Mesa aberta com sucesso!',
                idSessao: newSession.rows[0].id_sessao,
                isNew: true
            });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('[DEBUG] Erro CRÍTICO ao abrir sessão:', error);
            res.status(500).json({ error: error.message });
        } finally {
            client.release();
        }
    }
}