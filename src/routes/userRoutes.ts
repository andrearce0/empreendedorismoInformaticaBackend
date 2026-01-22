import { Router } from 'express';
import { UserController } from '../controllers/userController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

/**
 * GET /api/users
 * List all users.
 */
router.get('/', UserController.getAll);

router.get('/me', authenticate, UserController.getProfile);

/**
 * GET /api/users/:id
 * Get user by ID.
 */
router.get('/:id', UserController.getById);

export default router;
