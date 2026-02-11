import { Router } from 'express';
import express from 'express'; // Para o raw body do webhook
import { PaymentController } from '../controllers/paymentController.js';

const router = Router();

// Checkout Principal (Cria Pedido + Pagamento Total)
// URL: POST /api/payments/checkout
router.post('/checkout', PaymentController.createCheckoutSession);

// Divisão de Conta e Status
// URL: GET /api/payments/session/:sessionId/status
router.get('/session/:sessionId/status', PaymentController.getPaymentStatus);

// Criar Pagamento Parcial (Split)
// URL: POST /api/payments/session/:sessionId/split
router.post('/session/:sessionId/split', PaymentController.createSplitPayment);

// Link de Compartilhamento
// URL: GET /api/payments/session/:sessionId/share
router.get('/session/:sessionId/share', PaymentController.getShareLink);

// Webhook do Stripe
router.post('/webhooks/stripe', express.raw({ type: 'application/json' }), PaymentController.handleWebhook);

export default router;