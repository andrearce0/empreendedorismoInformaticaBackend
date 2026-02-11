import Stripe from 'stripe';
import * as db from '../config/db.js';
import { ensureTestData } from '../utils/testDataHelper.js';
import dotenv from 'dotenv';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const YOUR_DOMAIN = process.env.BASE_URL || 'http://localhost:3000';

export class PaymentController {

    /**
     * 1. Checkout Inicial (Carrinho Cheio)
     * (Substitui: app.post('/create-checkout-session'))
     */
    static async createCheckoutSession(req, res) {
        try {
            console.log('Checkout iniciado. Body:', req.body);
            const { sessionId: dbSessionId } = await ensureTestData();

            const amount = parseInt(req.body.amount);
            const cartItems = JSON.parse(req.body.cartItems || '[]');

            if (!amount || isNaN(amount)) throw new Error('Valor inválido');

            // Cria Pedido
            const pedidoResult = await db.query(
                `INSERT INTO pedidos (id_sessao, id_usuario_cliente, status) 
                 VALUES ($1, 1, 'CRIADO') RETURNING id_pedido`,
                [dbSessionId]
            );
            const pedidoId = pedidoResult.rows[0].id_pedido;

            // Insere Itens
            if (cartItems.length > 0) {
                for (const item of cartItems) {
                    await db.query(
                        `INSERT INTO pedidos_itens (id_pedido, id_item, quantidade, valor_unitario, valor_total)
                         VALUES ($1, $2, $3, $4, $5)`,
                        [pedidoId, item.id, item.quantity, item.preco, item.preco * item.quantity]
                    );
                }
            }

            // Cria Sessão Stripe
            const session = await stripe.checkout.sessions.create({
                line_items: [{
                    price_data: {
                        currency: 'brl',
                        product_data: { name: 'Pedido Restaurante' },
                        unit_amount: amount,
                    },
                    quantity: 1,
                }],
                mode: 'payment',
                success_url: `${YOUR_DOMAIN}?success=true`,
                cancel_url: `${YOUR_DOMAIN}?canceled=true`,
            });

            // Registra Pagamento Pendente
            await db.query(
                `INSERT INTO pagamentos (id_sessao, origem, valor_total, status, metodo, stripe_session_id) 
                 VALUES ($1, 'CONSUMO', $2, 'PENDENTE', 'CARTAO', $3)`,
                [dbSessionId, amount / 100, session.id]
            );

            res.redirect(303, session.url);

        } catch (error) {
            console.error('Erro no checkout:', error);
            res.status(500).send('Erro interno');
        }
    }

    /**
     * 2. Status do Pagamento e Divisão
     * (Substitui: app.get('/api/session/:sessionId/payment-status'))
     */
    static async getPaymentStatus(req, res) {
        try {
            const { sessionId } = req.params;
            const totalAmount = parseFloat(req.query.total || 0);

            // Busca pagamento existente
            let paymentResult = await db.query(
                "SELECT * FROM pagamentos WHERE id_sessao = $1 AND origem = 'CONSUMO' ORDER BY criado_em DESC LIMIT 1",
                [sessionId]
            );

            let paymentId;
            let currentTotalAmount = totalAmount;

            // Se não existe pagamento, cria um (lógica do seu código antigo)
            if (paymentResult.rows.length === 0) {
                if (totalAmount > 0) {
                    const insertResult = await db.query(
                        `INSERT INTO pagamentos (id_sessao, origem, valor_total, status, metodo) 
                         VALUES ($1, 'CONSUMO', $2, 'PENDENTE', 'CARTAO') RETURNING id_pagamento`,
                        [sessionId, totalAmount]
                    );
                    paymentId = insertResult.rows[0].id_pagamento;
                } else {
                    return res.status(404).json({ error: 'Pagamento não iniciado' });
                }
            } else {
                paymentId = paymentResult.rows[0].id_pagamento;
                currentTotalAmount = parseFloat(paymentResult.rows[0].valor_total);
            }

            // Busca divisões (quem já pagou)
            const divisionsResult = await db.query(
                `SELECT pd.*, u.nome_completo 
                 FROM pagamentos_divisoes pd
                 LEFT JOIN usuarios u ON pd.id_usuario_pagador = u.id_usuario
                 WHERE pd.id_pagamento = $1 ORDER BY pd.criado_em DESC`,
                [paymentId]
            );

            const divisions = divisionsResult.rows;
            const paidAmount = divisions
                .filter(d => ['PAGO', 'PENDENTE'].includes(d.status))
                .reduce((sum, d) => sum + parseFloat(d.valor), 0);

            const remainingAmount = currentTotalAmount - paidAmount;

            // Busca itens do último pedido para exibir
            const itemsResult = await db.query(
                `SELECT pi.quantidade as quantity, ci.nome as name, ci.preco as price
                 FROM pedidos p
                 JOIN pedidos_itens pi ON p.id_pedido = pi.id_pedido
                 JOIN cardapio_itens ci ON pi.id_item = ci.id_item
                 WHERE p.id_sessao = $1 ORDER BY p.criado_em DESC LIMIT 10`,
                [sessionId]
            );

            res.json({
                sessionId,
                paymentId,
                totalAmount: currentTotalAmount,
                paidAmount,
                remainingAmount,
                isComplete: remainingAmount <= 0.01,
                items: itemsResult.rows,
                divisions: divisions.map(d => ({
                    id: d.id_divisao,
                    amount: parseFloat(d.valor),
                    status: d.status,
                    payerName: d.nome_completo || 'Anônimo',
                    createdAt: d.criado_em
                }))
            });

        } catch (error) {
            console.error('Erro no status:', error);
            res.status(500).json({ error: 'Erro interno' });
        }
    }

    /**
     * 3. Criar Pagamento Parcial (Split)
     * (Substitui: app.post('/api/session/:sessionId/create-split-payment'))
     */
    static async createSplitPayment(req, res) {
        try {
            const { sessionId } = req.params;
            const { amount, payerName } = req.body;

            if (!amount || amount <= 0) return res.status(400).json({ error: 'Valor inválido' });

            const paymentResult = await db.query(
                "SELECT * FROM pagamentos WHERE id_sessao = $1 AND origem = 'CONSUMO' ORDER BY criado_em DESC LIMIT 1",
                [sessionId]
            );
            if (paymentResult.rows.length === 0) return res.status(404).json({ error: 'Pagamento principal não encontrado' });

            const paymentId = paymentResult.rows[0].id_pagamento;

            // Cria registro da divisão
            const divisionResult = await db.query(
                `INSERT INTO pagamentos_divisoes (id_pagamento, id_usuario_pagador, valor, status) 
                 VALUES ($1, 1, $2, 'PENDENTE') RETURNING id_divisao`,
                [paymentId, amount]
            );
            const divisionId = divisionResult.rows[0].id_divisao;

            // Cria sessão Stripe para essa fração
            const session = await stripe.checkout.sessions.create({
                line_items: [{
                    price_data: {
                        currency: 'brl',
                        product_data: {
                            name: `Divisão de Conta - ${payerName || 'Participante'}`,
                            description: `Sessão #${sessionId}`
                        },
                        unit_amount: Math.round(amount * 100),
                    },
                    quantity: 1,
                }],
                mode: 'payment',
                success_url: `${YOUR_DOMAIN}/split/${sessionId}?success=true`,
                cancel_url: `${YOUR_DOMAIN}/split/${sessionId}?canceled=true`,
                metadata: {
                    divisionId: divisionId.toString(),
                    sessionId: sessionId.toString(),
                    payerName: payerName || 'Anônimo'
                }
            });

            res.json({ checkoutUrl: session.url, divisionId });

        } catch (error) {
            console.error('Erro split:', error);
            res.status(500).json({ error: 'Erro interno' });
        }
    }

    /**
     * 4. Link de Compartilhamento
     * (Substitui: app.get('/api/session/:sessionId/share-link'))
     */
    static async getShareLink(req, res) {
        const { sessionId } = req.params;
        res.json({ shareUrl: `${YOUR_DOMAIN}/split/${sessionId}` });
    }

    /**
     * 5. Webhook (Confirmação Automática)
     * (Substitui: app.post('/api/webhooks/stripe'))
     */
    static async handleWebhook(req, res) {
        const event = req.body;

        try {
            if (event.type === 'checkout.session.completed') {
                const session = event.data.object;

                // Se for pagamento de DIVISÃO (tem metadata)
                if (session.metadata && session.metadata.divisionId) {
                    const { divisionId, sessionId, payerName } = session.metadata;

                    // 1. Marca divisão como paga
                    await db.query(
                        'UPDATE pagamentos_divisoes SET status = $1 WHERE id_divisao = $2',
                        ['PAGO', divisionId]
                    );
                    console.log(`Divisão ${divisionId} paga por ${payerName}`);

                    // 2. Verifica se quitou a conta total
                    const paymentResult = await db.query(
                        "SELECT * FROM pagamentos WHERE id_sessao = $1 AND origem = 'CONSUMO' ORDER BY criado_em DESC LIMIT 1",
                        [sessionId]
                    );

                    if (paymentResult.rows.length > 0) {
                        const paymentId = paymentResult.rows[0].id_pagamento;
                        const totalAmount = parseFloat(paymentResult.rows[0].valor_total);

                        const divRes = await db.query('SELECT * FROM pagamentos_divisoes WHERE id_pagamento = $1', [paymentId]);
                        const paid = divRes.rows
                            .filter(d => ['PAGO', 'PENDENTE'].includes(d.status))
                            .reduce((sum, d) => sum + parseFloat(d.valor), 0);

                        // Se pagou tudo (com margem de erro de centavos)
                        if (Math.abs(totalAmount - paid) < 0.05) {
                            await db.query('UPDATE pagamentos SET status = $1 WHERE id_pagamento = $2', ['CAPTURADO', paymentId]);
                            await db.query("UPDATE sessoes SET status = 'FECHADA', fim_efetivo = CURRENT_TIMESTAMP WHERE id_sessao = $1", [sessionId]);
                            console.log(`Sessão ${sessionId} totalmente paga e fechada!`);
                        }
                    }
                }
            }
            res.json({ received: true });
        } catch (error) {
            console.error('Webhook error:', error);
            res.status(400).json({ error: 'Webhook error' });
        }
    }
}