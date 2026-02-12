import * as db from '../config/db.js';

export class OrderController {

    /**
     * Cria um novo pedido para uma sessão aberta
     */
    static async createOrder(req, res) {
        const client = await db.getClient();
        try {
            const { sessionId, items } = req.body;
            // items espera ser um array: [{ idItem: 1, quantity: 2, observation: "Sem cebola" }]

            const userId = req.user.id;

            if (!items || items.length === 0) {
                return res.status(400).json({ error: 'O pedido não pode estar vazio.' });
            }

            await client.query('BEGIN');

            // 1. Validar Sessão
            const sessionCheck = await client.query(
                `SELECT id_sessao, status, id_restaurante FROM sessoes WHERE id_sessao = $1`,
                [sessionId]
            );

            if (sessionCheck.rows.length === 0) throw new Error('Sessão não encontrada.');
            if (sessionCheck.rows[0].status !== 'ABERTA') throw new Error('Esta mesa já foi fechada.');

            const idRestaurante = sessionCheck.rows[0].id_restaurante;

            // 2. Criar o "Cabeçalho" do Pedido
            const orderResult = await client.query(
                `INSERT INTO pedidos (id_sessao, id_usuario_cliente, status, criado_em)
                 VALUES ($1, $2, 'CRIADO', CURRENT_TIMESTAMP)
                 RETURNING id_pedido`,
                [sessionId, userId]
            );
            const orderId = orderResult.rows[0].id_pedido;

            let valorTotalPedido = 0;

            // 3. Processar cada item
            for (const item of items) {
                // A. Buscar preço real no banco (SEGURANÇA)
                const productRes = await client.query(
                    'SELECT preco, nome FROM cardapio_itens WHERE id_item = $1 AND id_restaurante = $2',
                    [item.idItem, idRestaurante]
                );

                if (productRes.rows.length === 0) {
                    throw new Error(`Item ID ${item.idItem} não existe ou não é deste restaurante.`);
                }

                const precoUnitario = parseFloat(productRes.rows[0].preco);
                const quantidade = parseInt(item.quantity);
                const subtotal = precoUnitario * quantidade;

                valorTotalPedido += subtotal;

                // B. Inserir na tabela de itens do pedido (SEM valor_total)
                await client.query(
                    `INSERT INTO pedidos_itens (id_pedido, id_item, quantidade, valor_unitario, observacoes)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [orderId, item.idItem, quantidade, precoUnitario, item.observation || '']
                );
            }

            // 4. (Opcional) Atualizar valor total no pedido se tiver coluna pra isso, 
            // ou deixar para calcular na hora de fechar a conta.
            // Por enquanto, vamos retornar o total calculado.

            await client.query('COMMIT');

            res.status(201).json({
                success: true,
                message: 'Pedido enviado para a cozinha!',
                data: {
                    orderId,
                    total: valorTotalPedido,
                    itemsCount: items.length
                }
            });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Erro ao criar pedido:', error);
            res.status(500).json({ error: error.message });
        } finally {
            client.release();
        }
    }

    /**
     * Lista os pedidos de uma sessão com validação de segurança
     */
    static async getOrdersBySession(req, res) {
        const client = await db.getClient();
        try {
            const { sessionId } = req.params;
            const userId = req.user.id; // ID de quem está tentando acessar

            // 1. Buscamos a sessão e o restaurante dela
            const sessionCheck = await client.query(
                `SELECT s.id_sessao, s.id_usuario_criador, s.id_restaurante 
                 FROM sessoes s 
                 WHERE s.id_sessao = $1`,
                [sessionId]
            );

            // CHECK 1: A sessão existe?
            if (sessionCheck.rows.length === 0) {
                return res.status(404).json({ error: 'Sessão não encontrada.' });
            }

            const session = sessionCheck.rows[0];

            // CHECK 2: Autorização (Quem pode ver os pedidos?)
            // Regra A: O próprio criador da sessão (Cliente)
            let hasPermission = (session.id_usuario_criador === userId);

            // Regra B: Se não for o criador, verificamos se é STAFF (Gerente/Garçom) do restaurante
            if (!hasPermission) {
                const staffCheck = await client.query(
                    `SELECT 1 FROM funcionarios_restaurante 
                     WHERE id_usuario = $1 AND id_restaurante = $2`,
                    [userId, session.id_restaurante]
                );
                if (staffCheck.rows.length > 0) {
                    hasPermission = true;
                }
            }

            if (!hasPermission) {
                return res.status(403).json({ error: 'Você não tem permissão para visualizar pedidos desta mesa.' });
            }

            // 3. Se passou nas checagens, busca os pedidos (Query corrigida sem valor_total fixo)
            const result = await client.query(
                `SELECT p.id_pedido, p.status, p.criado_em,
                        pi.quantidade, pi.valor_unitario, pi.observacoes,
                        (pi.quantidade * pi.valor_unitario) as valor_total,
                        ci.nome as nome_item
                 FROM pedidos p
                 JOIN pedidos_itens pi ON p.id_pedido = pi.id_pedido
                 JOIN cardapio_itens ci ON pi.id_item = ci.id_item
                 WHERE p.id_sessao = $1
                 ORDER BY p.criado_em DESC`,
                [sessionId]
            );

            res.json({ success: true, data: result.rows });

        } catch (error) {
            console.error(error);
            res.status(500).json({ error: error.message });
        } finally {
            client.release();
        }
    }
}