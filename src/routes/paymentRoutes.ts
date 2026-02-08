import { Router } from 'express';
import { PaymentController } from '../controllers/paymentController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

// Obter extrato da sessão
router.get('/session/:sessionId', authenticate, PaymentController.getBill);

// Iniciar um pagamento (Autorizar/Reter fundos)
router.post('/initiate', authenticate, PaymentController.initiatePayment);

// Finalizar um pagamento (Capturar fundos)
router.post('/capture/:paymentId', authenticate, PaymentController.capturePayment);

export default router;
