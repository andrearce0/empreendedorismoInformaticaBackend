import { Router } from 'express';
import { AuthController } from '../controllers/authController.js';

const router = Router();

// Rota para Login Anônimo
router.post('/anonymous', AuthController.loginAnonymous);
router.post('/register', AuthController.register);
router.post('/login', AuthController.login);

export default router;