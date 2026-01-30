import { Router } from 'express';
import { OrderController } from '../controllers/orderController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

// Rota para criar pedido
// Exige autenticação (pode ser login real ou anônimo/guest)
router.post('/', authenticate, OrderController.create);

export default router;