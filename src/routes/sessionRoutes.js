import { Router } from 'express';
import { SessionController } from '../controllers/sessionController.js';
import { PaymentController } from '../controllers/paymentController.js';
import { authenticate } from '../middlewares/authMiddleware.js';

const router = Router();

// Criar Sessão: POST /api/session/create
router.post('/create', authenticate, SessionController.openSession);

// Status do Pagamento: GET /api/session/:sessionId/payment-status
router.get('/:sessionId/payment-status', PaymentController.getPaymentStatus);

// Link de Compartilhamento: GET /api/session/:sessionId/share-link
router.get('/:sessionId/share-link', PaymentController.getShareLink);

// Criar Pagamento Parcial (Split): POST /api/session/:sessionId/create-split-payment
router.post('/:sessionId/create-split-payment', PaymentController.createSplitPayment);

export default router;