import type { Request, Response, NextFunction } from 'express';
import db from '../services/dbService.js';
import type { AuthRequest } from '../middleware/authMiddleware.js';

export class OrderController {

    /**
     * Cria um novo pedido vinculado a uma sessão.
     * Gera automaticamente os itens e os tickets para cozinha/bar.
     */
    static async create(req: Request, res: Response, next: NextFunction) {
        const client = await db.getClient();
        try {
            const { idSessao, itens } = req.body;
            const userId = (req as AuthRequest).user?.id || null;

            if (!idSessao || !itens || !Array.isArray(itens) || itens.length === 0) {
                return res.status(400).json({ success: false, message: 'Dados inválidos.' });
            }

            await client.query('BEGIN');

            // 1. Verificar Sessão e PEGAR O ID DO RESTAURANTE
            const sessionCheck = await client.query(
                `SELECT status, id_restaurante FROM sessoes WHERE id_sessao = $1`,
                [idSessao]
            );

            if (sessionCheck.rows.length === 0) throw new Error('Sessão não encontrada.');

            const sessionData = sessionCheck.rows[0]; // Dados da sessão

            if (sessionData.status !== 'ABERTA' && sessionData.status !== 'EM_ANDAMENTO') {
                throw new Error('Esta sessão já está fechada.');
            }

            // 2. Criar o Pedido
            const orderResult = await client.query(
                `INSERT INTO pedidos (id_sessao, id_usuario_cliente, status)
                 VALUES ($1, $2, 'ENVIADO_COZINHA')
                 RETURNING id_pedido`,
                [idSessao, userId]
            );
            const orderId = orderResult.rows[0].id_pedido;

            const processedItems = [];

            for (const item of itens) {
                const { idProduto, quantidade, observacao } = item;

                // --- CORREÇÃO DE SEGURANÇA AQUI ---
                // Trazemos também o id_restaurante do produto para comparar
                const productRes = await client.query(
                    `SELECT nome, preco, categoria, id_restaurante FROM cardapio_itens WHERE id_item = $1`,
                    [idProduto]
                );

                if (productRes.rows.length === 0) {
                    throw new Error(`Produto ID ${idProduto} não encontrado.`);
                }

                const product = productRes.rows[0];

                // TRAVA DE SEGURANÇA: O produto é deste restaurante?
                if (product.id_restaurante !== sessionData.id_restaurante) {
                    throw new Error(`Erro: O item '${product.nome}' não pertence ao restaurante desta sessão.`);
                }
                // ----------------------------------

                const valorUnitario = Number(product.preco);
                const valorTotal = valorUnitario * Number(quantidade);

                // Inserir Item
                const itemInsert = await client.query(
                    `INSERT INTO pedidos_itens (id_pedido, id_item, quantidade, observacoes, valor_unitario, valor_total)
                     VALUES ($1, $2, $3, $4, $5, $6)
                     RETURNING id_pedido_item`,
                    [orderId, idProduto, quantidade, observacao, valorUnitario, valorTotal]
                );

                const idPedidoItem = itemInsert.rows[0].id_pedido_item;

                // Criar Ticket (Fila)
                let setor = 'COZINHA';
                if (product.categoria && product.categoria.toLowerCase().includes('bebida')) {
                    setor = 'BAR';
                }

                await client.query(
                    `INSERT INTO cozinha_filas (id_pedido_item, setor, status)
                     VALUES ($1, $2, 'AGUARDANDO')`,
                    [idPedidoItem, setor]
                );

                processedItems.push({ item: product.nome, qtd: quantidade, setor });
            }

            // Atualiza status da sessão se necessário
            await client.query(
                `UPDATE sessoes SET status = 'EM_ANDAMENTO' WHERE id_sessao = $1 AND status = 'ABERTA'`,
                [idSessao]
            );

            await client.query('COMMIT');

            res.status(201).json({
                success: true,
                message: 'Pedido realizado!',
                data: { orderId, items: processedItems }
            });

        } catch (error) {
            await client.query('ROLLBACK');
            next(error);
        } finally {
            client.release();
        }
    }
}