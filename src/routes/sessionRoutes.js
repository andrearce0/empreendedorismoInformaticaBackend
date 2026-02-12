import { Router } from 'express';
import { SessionController } from '../controllers/sessionController.js';
import { authenticate } from '../middlewares/authMiddleware.js';

const router = Router();

router.post('/sessions/open', authenticate, SessionController.openSession);

export default router;