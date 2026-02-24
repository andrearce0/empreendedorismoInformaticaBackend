import { Router } from 'express';
import { RestaurantController } from '../controllers/restaurantController.js';

const router = Router();

<<<<<<< HEAD
// Rota pública para listar todos os restaurantes (usada no mapa)
router.get('/restaurants', RestaurantController.listAll);

// Rota pública para ver o cardápio de um restaurante
router.get('/menu/:restaurantId', RestaurantController.getMenu);
=======
// Rota para listar todos os restaurantes
// URL: GET /api/restaurants
router.get('/', RestaurantController.getAll);

// Rota para buscar o cardápio de um restaurante específico
// URL: GET /api/restaurants/menu/:id
router.get('/menu/:id', RestaurantController.getMenu);
>>>>>>> 1665afe572a8173f4badc3e38428394d29917825

export default router;
