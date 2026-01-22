import { Router } from 'express';
import { AllergenController } from '../controllers/allergenController.js';

const router = Router();

/**
 * Public route to list all allergens.
 */
router.get('/', AllergenController.getAll);

export default router;
