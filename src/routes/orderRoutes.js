import { Router } from 'express';
import { OrderController } from '../controllers/orderController.js';
import { authenticate } from '../middlewares/authMiddleware.js';

const router = Router();

router.use(authenticate);

// Fazer Pedido
router.post('/orders', OrderController.createOrder);

// Ver Pedidos da Sessão
router.get('/session/:sessionId/orders', OrderController.getOrdersBySession);

export default router;