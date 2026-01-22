import { Router } from 'express';
import { AuthController } from '../controllers/authController.js';

const router = Router();

/**
 * POST /api/auth/register
 * Public route to register a new user.
 */
router.post('/register', AuthController.register);

/**
 * POST /api/auth/login
 * Public route to login and get a JWT token.
 */
router.post('/login', AuthController.login);

export default router;
