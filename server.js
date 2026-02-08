const express = require('express');
require('dotenv').config();
const db = require('./db');
const { ensureTestData } = require('./testDataHelper');
const cors = require('cors');

// This is your test secret API key.
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const app = express();
app.use(cors());
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const YOUR_DOMAIN = process.env.BASE_URL || 'http://localhost:3000';

app.post('/create-checkout-session', async (req, res) => {
    try {
        console.log('Received Checkout request. Body:', req.body);
        // Initially ensuring we have a restaurant and a session
        const { sessionId: dbSessionId } = await ensureTestData();

        // Get amount from body (sent by the frontend form)
        const amount = parseInt(req.body.amount);
        const cartItems = JSON.parse(req.body.cartItems || '[]');

        console.log('Parsed amount:', amount);
        if (!amount || isNaN(amount)) {
            throw new Error('Invalid amount: ' + req.body.amount);
        }

        // 1. Create Pedido record
        const pedidoResult = await db.query(
            `INSERT INTO pedidos (id_sessao, id_usuario_cliente, status) 
       VALUES ($1, 1, 'CRIADO') RETURNING id_pedido`,
            [dbSessionId]
        );
        const pedidoId = pedidoResult.rows[0].id_pedido;

        // 2. Insert items into pedidos_itens
        if (cartItems.length > 0) {
            for (const item of cartItems) {
                await db.query(
                    `INSERT INTO pedidos_itens (id_pedido, id_item, quantidade, valor_unitario, valor_total)
                 VALUES ($1, $2, $3, $4, $5)`,
                    [pedidoId, item.id, item.quantity, item.preco, item.preco * item.quantity]
                );
            }
        }

        const currency = 'brl';

        const session = await stripe.checkout.sessions.create({
            line_items: [
                {
                    price_data: {
                        currency: currency,
                        product_data: {
                            name: 'Pedido Restaurante',
                        },
                        unit_amount: amount,
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${YOUR_DOMAIN}?success=true`,
            cancel_url: `${YOUR_DOMAIN}?canceled=true`,
        });

        // Save payment to DB as PENDING
        await db.query(
            `INSERT INTO pagamentos (id_sessao, origem, valor_total, status, metodo, stripe_session_id) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
            [dbSessionId, 'CONSUMO', amount / 100, 'PENDENTE', 'CARTAO', session.id]
        );

        console.log(`Payment record created for session ${dbSessionId} and Stripe Session ${session.id} with amount ${amount}`);

        res.redirect(303, session.url);
    } catch (error) {
        console.error('Error creating checkout session:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/api/restaurants', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT id_restaurante, nome_fantasia, latitude, longitude, categoria_principal FROM restaurantes WHERE ativo = true'
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching restaurants:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/api/menu/:restaurantId', async (req, res) => {
    try {
        const { restaurantId } = req.params;
        const result = await db.query(
            `SELECT id_item, nome, descricao, preco 
       FROM cardapio_itens 
       WHERE id_restaurante = $1 AND ativo = true 
       ORDER BY nome ASC`,
            [restaurantId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching menu items:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ===== SESSION MANAGEMENT =====

// Create or get session
app.post('/api/session/create', async (req, res) => {
    try {
        const { restaurantId } = req.body;

        // Use restaurant ID 1 as default if not provided
        const restId = restaurantId || 1;

        // Create new session
        const sessionResult = await db.query(
            `INSERT INTO sessoes (id_restaurante, id_usuario_criador, origem, status, inicio_efetivo) 
       VALUES ($1, 1, 'MAPA', 'ABERTA', CURRENT_TIMESTAMP) 
       RETURNING id_sessao`,
            [restId]
        );

        const sessionId = sessionResult.rows[0].id_sessao;

        res.json({ sessionId });
    } catch (error) {
        console.error('Error creating session:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ===== BILL SPLITTING ENDPOINTS =====

// Get payment status for a session
app.get('/api/session/:sessionId/payment-status', async (req, res) => {
    try {
        const { sessionId } = req.params;

        // Get session info
        const sessionResult = await db.query(
            'SELECT * FROM sessoes WHERE id_sessao = $1',
            [sessionId]
        );

        if (sessionResult.rows.length === 0) {
            return res.status(404).json({ error: 'Session not found' });
        }

        // Calculate total from cart (localStorage) - for now we'll accept it from query param
        // In production, this should be calculated from pedidos_itens
        const totalAmount = parseFloat(req.query.total || 0);

        // Get payment record for this session
        let paymentResult = await db.query(
            'SELECT * FROM pagamentos WHERE id_sessao = $1 AND origem = \'CONSUMO\' ORDER BY criado_em DESC LIMIT 1',
            [sessionId]
        );

        let paymentId;
        let currentTotalAmount = totalAmount; // Default to query param

        if (paymentResult.rows.length === 0) {
            // If we don't have a payment and requests sends 0 (e.g. shared link opened before creator), 
            // we can't create a valid payment yet.
            if (totalAmount <= 0) {
                // Try to match behavior: return what we have (likely 0 total, 0 paid) or 404? 
                // Let's create it only if total > 0.
                // But for now, to preserve flow, if total > 0 create it.
            }

            if (totalAmount > 0) {
                // Create payment record if it doesn't exist
                const insertResult = await db.query(
                    `INSERT INTO pagamentos (id_sessao, origem, valor_total, status, metodo) 
            VALUES ($1, 'CONSUMO', $2, 'PENDENTE', 'CARTAO') RETURNING id_pagamento`,
                    [sessionId, totalAmount]
                );
                paymentId = insertResult.rows[0].id_pagamento;
            } else {
                // No payment exists and no total provided.
                // We can't return meaningful data.
                // However, to prevent crashes, let's assume 0 for now or handle gracefully.
                // Returning 404 for payment might be better but let's stick to structure.
                return res.status(404).json({ error: 'Payment not initiated and no total provided' });
            }
        } else {
            paymentId = paymentResult.rows[0].id_pagamento;
            // IMPORTANT: Use the total from the DB, not the query param
            // This fixes the issue where a shared user (with empty cart/total=0) sees 0 total
            currentTotalAmount = parseFloat(paymentResult.rows[0].valor_total);
        }

        // Update local variable for downstream logic
        const finalTotalAmount = currentTotalAmount;

        // Get all payment divisions
        const divisionsResult = await db.query(
            `SELECT pd.*, u.nome_completo 
       FROM pagamentos_divisoes pd
       LEFT JOIN usuarios u ON pd.id_usuario_pagador = u.id_usuario
       WHERE pd.id_pagamento = $1
       ORDER BY pd.criado_em DESC`,
            [paymentId]
        );

        const divisions = divisionsResult.rows;
        const paidAmount = divisions
            .filter(d => d.status === 'PAGO' || d.status === 'PENDENTE')
            .reduce((sum, d) => sum + parseFloat(d.valor), 0);
        const remainingAmount = finalTotalAmount - paidAmount;

        // Get items from the latest order for this session
        const itemsResult = await db.query(
            `SELECT pi.quantidade as quantity, ci.nome as name, ci.preco as price
       FROM pedidos p
       JOIN pedidos_itens pi ON p.id_pedido = pi.id_pedido
       JOIN cardapio_itens ci ON pi.id_item = ci.id_item
       WHERE p.id_sessao = $1
       ORDER BY p.criado_em DESC LIMIT 1`,
            [sessionId]
        );

        let items = [];
        if (itemsResult.rows.length > 0) {
            items = itemsResult.rows.map(row => ({
                quantity: row.quantity,
                name: row.name,
                price: row.price
            }));

            // If we have items from DB, we might want to fetch items for specific order if needed
            // For now, getting items from the latest order is sufficient
            const orderId = itemsResult.rows[0].id_pedido; // catch this earlier if needed

            const itemsDetailResult = await db.query(
                `SELECT pi.quantidade as quantity, ci.nome as name, ci.preco as price
             FROM pedidos_itens pi
             JOIN cardapio_itens ci ON pi.id_item = ci.id_item
             WHERE pi.id_pedido = (SELECT id_pedido FROM pedidos WHERE id_sessao = $1 ORDER BY criado_em DESC LIMIT 1)`,
                [sessionId]
            );
            items = itemsDetailResult.rows;
        }

        res.json({
            sessionId,
            paymentId,
            totalAmount: finalTotalAmount,
            paidAmount,
            remainingAmount,
            isComplete: remainingAmount <= 0.01, // Small threshold for floating point
            items, // Return the items
            divisions: divisions.map(d => ({
                id: d.id_divisao,
                amount: parseFloat(d.valor),
                status: d.status,
                payerName: d.nome_completo || 'Anônimo',
                createdAt: d.criado_em
            }))
        });
    } catch (error) {
        console.error('Error fetching payment status:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Create split payment
app.post('/api/session/:sessionId/create-split-payment', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { amount, payerName } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }

        // Get payment record
        const paymentResult = await db.query(
            'SELECT * FROM pagamentos WHERE id_sessao = $1 AND origem = \'CONSUMO\' ORDER BY criado_em DESC LIMIT 1',
            [sessionId]
        );

        if (paymentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Payment not found' });
        }

        const paymentId = paymentResult.rows[0].id_pagamento;

        // Create payment division record (using user ID 1 for anonymous)
        const divisionResult = await db.query(
            `INSERT INTO pagamentos_divisoes (id_pagamento, id_usuario_pagador, valor, status) 
       VALUES ($1, 1, $2, 'PENDENTE') RETURNING id_divisao`,
            [paymentId, amount]
        );

        const divisionId = divisionResult.rows[0].id_divisao;

        // Create Stripe checkout session
        const amountInCents = Math.round(amount * 100);
        const session = await stripe.checkout.sessions.create({
            line_items: [
                {
                    price_data: {
                        currency: 'brl',
                        product_data: {
                            name: `Divisão de Conta - ${payerName || 'Participante'}`,
                            description: `Sessão #${sessionId}`
                        },
                        unit_amount: amountInCents,
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${YOUR_DOMAIN}/split/${sessionId}?success=true`,
            cancel_url: `${YOUR_DOMAIN}/split/${sessionId}?canceled=true`,
            metadata: {
                divisionId: divisionId.toString(),
                sessionId: sessionId.toString(),
                payerName: payerName || 'Anônimo'
            }
        });

        // Update division with stripe session ID
        await db.query(
            'UPDATE pagamentos_divisoes SET status = $1 WHERE id_divisao = $2',
            ['PENDENTE', divisionId]
        );

        res.json({
            checkoutUrl: session.url,
            divisionId
        });
    } catch (error) {
        console.error('Error creating split payment:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Get shareable link
app.get('/api/session/:sessionId/share-link', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const shareUrl = `${YOUR_DOMAIN}/split/${sessionId}`;
        res.json({ shareUrl });
    } catch (error) {
        console.error('Error generating share link:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Stripe webhook handler
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        // In production, verify webhook signature
        // event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);

        // For now, parse the event directly
        event = req.body;

        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            const { divisionId, sessionId, payerName } = session.metadata;

            // Update division status to PAGO
            await db.query(
                'UPDATE pagamentos_divisoes SET status = $1 WHERE id_divisao = $2',
                ['PAGO', divisionId]
            );

            console.log(`Payment division ${divisionId} marked as PAGO by ${payerName}`);

            // Check if all divisions are paid
            const paymentResult = await db.query(
                'SELECT * FROM pagamentos WHERE id_sessao = $1 AND origem = \'CONSUMO\' ORDER BY criado_em DESC LIMIT 1',
                [sessionId]
            );

            if (paymentResult.rows.length > 0) {
                const paymentId = paymentResult.rows[0].id_pagamento;
                const totalAmount = parseFloat(paymentResult.rows[0].valor_total);

                const divisionsResult = await db.query(
                    'SELECT * FROM pagamentos_divisoes WHERE id_pagamento = $1',
                    [paymentId]
                );

                const paidAmount = divisionsResult.rows
                    .filter(d => d.status === 'PAGO' || d.status === 'PENDENTE') // Assuming PENDENTE here counts towards paid in a naive way or should strict to PAGO? Logic copied from source.
                    .reduce((sum, d) => sum + parseFloat(d.valor), 0);

                // If all paid (with small threshold for floating point)
                if (Math.abs(totalAmount - paidAmount) < 0.01) {
                    // Update payment status to CAPTURADO
                    await db.query(
                        'UPDATE pagamentos SET status = $1 WHERE id_pagamento = $2',
                        ['CAPTURADO', paymentId]
                    );

                    // Update session status to FECHADA
                    await db.query(
                        'UPDATE sessoes SET status = $1, fim_efetivo = CURRENT_TIMESTAMP WHERE id_sessao = $2',
                        ['FECHADA', sessionId]
                    );

                    console.log(`Session ${sessionId} fully paid and closed!`);
                }
            }
        }

        res.json({ received: true });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(400).json({ error: 'Webhook error' });
    }
});

const PORT = process.env.SERVER_PORT || 4242;
app.listen(PORT, () => console.log(`Running on port ${PORT}`));
