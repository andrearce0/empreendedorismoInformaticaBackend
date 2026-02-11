import { Router } from 'express';
import { ManagerController } from '../controllers/managerController.js';
import { authenticate } from '../middlewares/authMiddleware.js';

const router = Router();

router.use(authenticate);

// Criar Restaurante
router.post('/restaurant', ManagerController.createRestaurant);

// Listar Meus Restaurantes
router.get('/restaurants', ManagerController.getMyRestaurants);

// Adicionar funcionário (POST /api/manager/restaurant/:restaurantId/staff)
router.post('/restaurant/:restaurantId/staff', ManagerController.addStaff);

// Listar equipe (GET /api/manager/restaurant/:restaurantId/staff)
router.get('/restaurant/:restaurantId/staff', ManagerController.listStaff);

// Criar Item: POST /api/manager/restaurant/:restaurantId/menu
router.post('/restaurant/:restaurantId/menu', ManagerController.createMenuItem);

// Listar Itens: GET /api/manager/restaurant/:restaurantId/menu
router.get('/restaurant/:restaurantId/menu', ManagerController.listMenuItems);

// Criar Ingrediente: POST /api/manager/restaurant/:restaurantId/ingredients
router.post('/restaurant/:restaurantId/ingredients', ManagerController.createIngredient);

// Listar Ingredientes: GET /api/manager/restaurant/:restaurantId/ingredients
router.get('/restaurant/:restaurantId/ingredients', ManagerController.listIngredients);

// Adicionar Ingrediente ao Item: POST /api/manager/restaurant/:restaurantId/menu/:itemId/ingredients
router.post('/restaurant/:restaurantId/menu/:itemId/ingredients', ManagerController.addIngredientToItem);

// Ver ingredientes do Item: GET /api/manager/restaurant/:restaurantId/menu/:itemId/ingredients
router.get('/restaurant/:restaurantId/menu/:itemId/ingredients', ManagerController.getIngredientsByItem);

export default router;