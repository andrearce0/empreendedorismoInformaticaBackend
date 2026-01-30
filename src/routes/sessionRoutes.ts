import { Router } from 'express';
import { SessionController } from '../controllers/sessionController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

// Rota: POST /api/sessions/open
// Exige autenticação (Token de Cliente ou Guest)
router.post('/open', authenticate, SessionController.open);

export default router;