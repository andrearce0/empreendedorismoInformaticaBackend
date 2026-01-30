import { Router } from 'express';
import { ManagerController } from '../controllers/managerController.js';
import { authenticate, authorize } from '../middleware/authMiddleware.js';

const router = Router();

router.use(authenticate);

router.post('/restaurant', ManagerController.createRestaurant);

router.get('/restaurants', ManagerController.getMyRestaurants);

router.use(authorize(['GERENTE']));

//Configuracoes
router.patch('/:restaurantId/settings', ManagerController.updateSettings);

//Equipe
router.post('/:restaurantId/staff', ManagerController.addStaff);
router.get('/:restaurantId/staff', ManagerController.listStaff);

//Cardapio
router.post('/:restaurantId/menu', ManagerController.createMenuItem);
router.get('/:restaurantId/menu', ManagerController.listMenuItems);

//Mesas
router.post('/:restaurantId/tables', ManagerController.createTable);

//Analytics
router.get('/:restaurantId/analytics', ManagerController.getAnalytics);


//Ingredientes
router.post('/:restaurantId/ingredients', ManagerController.createIngredient);
router.get('/:restaurantId/ingredients', ManagerController.listIngredients);
//relacionar ingredientes ao item do cardapio
router.post('/:restaurantId/menu/:itemId/ingredients', ManagerController.addIngredientToItem);
router.get('/:restaurantId/menu/:itemId/ingredients', ManagerController.getIngredientsByItem);
export default router;