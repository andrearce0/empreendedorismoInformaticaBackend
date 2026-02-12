import { Router } from 'express';
import { KitchenController } from '../controllers/kitchenController.js';
import { authenticate } from '../middlewares/authMiddleware.js';

const router = Router();

router.use(authenticate);

// Listar Fila (Com filtro opcional ?setor=Bebidas)
router.get('/queue', KitchenController.getQueue);

// Atualizar Status de um ITEM DA FILA (Ex: idFila 5 ficou PRONTO)
// Note que usamos :idFila, não :orderId
router.patch('/queue/:idFila/status', KitchenController.updateItemStatus);

export default router;