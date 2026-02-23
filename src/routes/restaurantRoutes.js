import { Router } from 'express';
import { RestaurantController } from '../controllers/restaurantController.js';

const router = Router();

// Rota para listar todos os restaurantes
// URL: GET /api/restaurants
router.get('/', RestaurantController.getAll);

// Rota para buscar o cardápio de um restaurante específico
// URL: GET /api/restaurants/menu/:id
router.get('/menu/:id', RestaurantController.getMenu);

export default router;
