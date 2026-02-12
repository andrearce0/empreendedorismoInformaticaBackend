import * as db from '../config/db.js';

export class KitchenController {

    /**
     * Lista a fila de produção (Pode filtrar por setor: ?setor=Bebidas)
     */
    static async getQueue(req, res) {
        const client = await db.getClient();
        try {
            const userId = req.user.id;
            const { setor } = req.query;

            // 1. Descobrir restaurante
            const staffCheck = await client.query(
                `SELECT id_restaurante, funcao FROM funcionarios_restaurante WHERE id_usuario = $1`,
                [userId]
            );

            if (staffCheck.rows.length === 0) {
                console.log(`[DEBUG] Usuário ${userId} não tem vínculo com nenhum restaurante.`);
                return res.status(403).json({ error: 'Sem vínculo.' });
            }

            const restaurantId = staffCheck.rows[0].id_restaurante;
            console.log(`[DEBUG] Buscando fila para Restaurante ID: ${restaurantId}. Filtro Setor: ${setor || 'TODOS'}`);

            // 2. Query inteligente
            let query = `
                SELECT cf.id_fila, cf.status, cf.setor, cf.criado_em,
                       ci.nome as nome_item, pi.quantidade, pi.observacoes,
                       m.identificador_mesa, p.id_pedido
                FROM cozinha_filas cf
                JOIN pedidos_itens pi ON cf.id_pedido_item = pi.id_pedido_item
                JOIN cardapio_itens ci ON pi.id_item = ci.id_item
                JOIN pedidos p ON pi.id_pedido = p.id_pedido
                JOIN sessoes s ON p.id_sessao = s.id_sessao
                JOIN mesas m ON s.id_mesa = m.id_mesa
                WHERE s.id_restaurante = $1 
                  AND cf.status NOT IN ('ENTREGUE', 'CANCELADO')
            `;

            const params = [restaurantId];

            if (setor) {
                // [CORREÇÃO] Usamos ILIKE e % para ignorar maiúsculas e espaços extras
                query += ` AND cf.setor ILIKE $2`;
                params.push(`%${setor.trim()}%`);
            }

            query += ` ORDER BY cf.criado_em ASC`;

            const result = await client.query(query, params);

            console.log(`[DEBUG] Itens encontrados: ${result.rows.length}`);

            res.json({ success: true, data: result.rows });

        } catch (error) {
            console.error(error);
            res.status(500).json({ error: error.message });
        } finally {
            client.release();
        }
    }

    /**
     * Atualiza status de um ITEM ESPECÍFICO (Ex: Hambúrguer pronto, Batata ainda não)
     */
    static async updateItemStatus(req, res) {
        const client = await db.getClient();
        try {
            const { idFila } = req.params; // ID da linha na cozinha_filas
            const { status } = req.body;   // 'EM_PREPARO', 'PRONTO', 'ENTREGUE'

            // Atualiza
            await client.query(
                `UPDATE cozinha_filas SET status = $1, atualizado_em = CURRENT_TIMESTAMP 
                 WHERE id_fila = $2`,
                [status, idFila]
            );


            res.json({ success: true, message: 'Status do item atualizado.' });

        } catch (error) {
            console.error(error);
            res.status(500).json({ error: error.message });
        } finally {
            client.release();
        }
    }
}