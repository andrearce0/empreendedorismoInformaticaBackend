import { Router } from 'express';
import { RestaurantController } from '../controllers/restaurantController.js';

const router = Router();

// Rota pública para listar todos os restaurantes (usada no mapa)
router.get('/restaurants', RestaurantController.listAll);

// Rota pública para ver o cardápio de um restaurante
router.get('/menu/:restaurantId', RestaurantController.getMenu);

export default router;
