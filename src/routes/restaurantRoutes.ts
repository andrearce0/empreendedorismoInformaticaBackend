import { Router } from 'express';
import { RestaurantController } from '../controllers/restaurantController.js';

const router = Router();

/**
 * GET /api/restaurants
 * List all active restaurants.
 */
router.get('/', RestaurantController.getAll);

/**
 * GET /api/restaurants/:id
 * Get details of a specific restaurant.
 */
router.get('/:id', RestaurantController.getById);

/**
 * POST /api/restaurants
 * Register a new restaurant.
 */
router.post('/', RestaurantController.create);

export default router;
