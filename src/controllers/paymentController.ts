import type { Request, Response, NextFunction } from 'express';
import db from '../services/dbService.js';
import { StripeService } from '../services/stripeService.js';
import type { AuthRequest } from '../middleware/authMiddleware.js';

export class PaymentController {
    /**
     * Obtém o extrato da sessão, somando pedidos e subtraindo pagamentos capturados.
     */
    static async getBill(req: Request, res: Response, next: NextFunction) {
        try {
            const { sessionId } = req.params;

            // 1. Somar valor total dos itens de todos os pedidos da sessão
            const totalResult = await db.query(
                `SELECT COALESCE(SUM(pi.valor_total), 0) as total
                 FROM pedidos p
                 JOIN pedidos_itens pi ON p.id_pedido = pi.id_pedido
                 WHERE p.id_sessao = $1 AND p.status != 'CANCELADO'`,
                [sessionId]
            );

            // 2. Somar pagamentos já CAPTURADOS ou AUTORIZADOS (retidos)
            const paidResult = await db.query(
                `SELECT COALESCE(SUM(valor_total), 0) as paid
                 FROM pagamentos
                 WHERE id_sessao = $1 AND status IN ('AUTORIZADO', 'CAPTURADO')`,
                [sessionId]
            );

            const total = parseFloat(totalResult.rows[0].total);
            const paid = parseFloat(paidResult.rows[0].paid);
            const remaining = Math.max(0, total - paid);

            // 3. Buscar detalhes dos pedidos para o extrato
            const itemsResult = await db.query(
                `SELECT pi.id_pedido_item, ci.nome, pi.quantidade, pi.valor_unitario, pi.valor_total
                 FROM pedidos p
                 JOIN pedidos_itens pi ON p.id_pedido = pi.id_pedido
                 JOIN cardapio_itens ci ON pi.id_item = ci.id_item
                 WHERE p.id_sessao = $1 AND p.status != 'CANCELADO'`,
                [sessionId]
            );

            res.json({
                success: true,
                data: {
                    total,
                    paid,
                    remaining,
                    items: itemsResult.rows
                }
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Inicia um pagamento, autorizando o valor no Stripe e salvando no banco.
     */
    static async initiatePayment(req: Request, res: Response, next: NextFunction) {
        const client = await db.getClient();
        try {
            const { idSessao, valor, metodo } = req.body;
            const userId = (req as AuthRequest).user?.id;

            if (!idSessao || !valor || !metodo) {
                return res.status(400).json({ success: false, message: 'Dados incompletos.' });
            }

            await client.query('BEGIN');

            let stripeIntentId = null;
            let status = 'PENDENTE';

            if (metodo === 'CARTAO') {
                // Stripe usa centavos
                const amountCentamos = Math.round(valor * 100);
                const intent = await StripeService.createPaymentIntent(amountCentamos, 'brl', {
                    sessionId: idSessao,
                    userId: userId?.toString()
                });
                stripeIntentId = intent.id;
                status = 'AUTORIZADO'; // Retido no banco
            }

            // Registrar o pagamento na tabela principal
            const paymentResult = await client.query(
                `INSERT INTO pagamentos (id_sessao, origem, valor_total, status, metodo, stripe_payment_intent_id)
                 VALUES ($1, 'CONSUMO', $2, $3, $4, $5)
                 RETURNING id_pagamento`,
                [idSessao, valor, status, metodo, stripeIntentId]
            );

            const paymentId = paymentResult.rows[0].id_pagamento;

            // Registrar na tabela de divisões (quem está pagando esta parte)
            if (userId) {
                await client.query(
                    `INSERT INTO pagamentos_divisoes (id_pagamento, id_usuario_pagador, valor, status)
                     VALUES ($1, $2, $3, $4)`,
                    [paymentId, userId, valor, status === 'AUTORIZADO' ? 'PENDENTE' : 'PENDENTE']
                );
            }

            await client.query('COMMIT');

            res.status(201).json({
                success: true,
                message: metodo === 'CARTAO' ? 'Valor retido com sucesso.' : 'Pagamento registrado.',
                data: {
                    paymentId,
                    stripeClientSecret: stripeIntentId // O front usará isso se necessário
                }
            });

        } catch (error) {
            await client.query('ROLLBACK');
            next(error);
        } finally {
            client.release();
        }
    }

    /**
     * Finaliza (Captura) um pagamento previamente autorizado.
     */
    static async capturePayment(req: Request, res: Response, next: NextFunction) {
        const client = await db.getClient();
        try {
            const { paymentId } = req.params;

            const paymentResult = await client.query(
                `SELECT * FROM pagamentos WHERE id_pagamento = $1`,
                [paymentId]
            );

            if (paymentResult.rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Pagamento não encontrado.' });
            }

            const payment = paymentResult.rows[0];

            if (payment.status !== 'AUTORIZADO') {
                return res.status(400).json({ success: false, message: 'Pagamento não está em estado de autorização.' });
            }

            await client.query('BEGIN');

            // Capturar no Stripe
            if (payment.stripe_payment_intent_id) {
                await StripeService.capturePaymentIntent(payment.stripe_payment_intent_id);
            }

            // Atualizar status no banco
            await client.query(
                `UPDATE pagamentos SET status = 'CAPTURADO', atualizado_em = CURRENT_TIMESTAMP WHERE id_pagamento = $1`,
                [paymentId]
            );

            await client.query(
                `UPDATE pagamentos_divisoes SET status = 'PAGO' WHERE id_pagamento = $1`,
                [paymentId]
            );

            // Verificar se a sessão pode ser fechada
            const sessionId = payment.id_sessao;

            // Recalcular saldo
            const totalRes = await client.query(
                `SELECT COALESCE(SUM(pi.valor_total), 0) as total
                 FROM pedidos p JOIN pedidos_itens pi ON p.id_pedido = pi.id_pedido
                 WHERE p.id_sessao = $1 AND p.status != 'CANCELADO'`,
                [sessionId]
            );
            const paidRes = await client.query(
                `SELECT COALESCE(SUM(valor_total), 0) as paid
                 FROM pagamentos WHERE id_sessao = $1 AND status = 'CAPTURADO'`,
                [sessionId]
            );

            const total = parseFloat(totalRes.rows[0].total);
            const paid = parseFloat(paidRes.rows[0].paid);

            if (paid >= total && total > 0) {
                await client.query(
                    `UPDATE sessoes SET status = 'FECHADA', fim_efetivo = CURRENT_TIMESTAMP WHERE id_sessao = $1`,
                    [sessionId]
                );
            }

            await client.query('COMMIT');

            res.json({ success: true, message: 'Pagamento finalizado com sucesso.' });

        } catch (error) {
            await client.query('ROLLBACK');
            next(error);
        } finally {
            client.release();
        }
    }
}
