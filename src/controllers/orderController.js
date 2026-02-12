import * as db from '../config/db.js';

export class OrderController {

    /**
     * Cria um novo pedido para uma sessão aberta
     */
    static async createOrder(req, res) {
        const client = await db.getClient();
        try {
            const { sessionId, items } = req.body;
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

            // 3. Processar cada item
            for (const item of items) {
                // A. Buscar preço E CATEGORIA (Importante para a Cozinha)
                const productRes = await client.query(
                    'SELECT preco, nome, categoria FROM cardapio_itens WHERE id_item = $1 AND id_restaurante = $2',
                    [item.idItem, idRestaurante]
                );

                if (productRes.rows.length === 0) {
                    throw new Error(`Item ID ${item.idItem} não existe ou não é deste restaurante.`);
                }

                const produto = productRes.rows[0]; // Guardamos o produto para usar categoria depois
                const precoUnitario = parseFloat(produto.preco);
                const quantidade = parseInt(item.quantity);

                // B. Inserir na tabela de itens do pedido E GUARDAR O RESULTADO (itemResult)
                // [AQUI ESTAVA O ERRO]: Precisamos do "const itemResult =" antes do await
                const itemResult = await client.query(
                    `INSERT INTO pedidos_itens (id_pedido, id_item, quantidade, valor_unitario, observacoes)
                     VALUES ($1, $2, $3, $4, $5)
                     RETURNING id_pedido_item`,
                    [orderId, item.idItem, quantidade, precoUnitario, item.observation || '']
                );

                // Agora a variável itemResult existe!
                const idPedidoItem = itemResult.rows[0].id_pedido_item;

                // C. Inserir na Fila de Produção (KDS)
                // Usamos a categoria que pegamos lá em cima no passo A
                const setor = produto.categoria || 'GERAL';

                await client.query(
                    `INSERT INTO cozinha_filas (id_pedido_item, setor, status, criado_em)
                     VALUES ($1, $2, 'PENDENTE', CURRENT_TIMESTAMP)`,
                    [idPedidoItem, setor]
                );
            }

            await client.query('COMMIT');

            res.status(201).json({
                success: true,
                message: 'Pedido enviado para a cozinha!',
                data: {
                    orderId,
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