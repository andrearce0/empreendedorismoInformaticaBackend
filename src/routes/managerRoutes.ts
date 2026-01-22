import { Router } from 'express';
import { ManagerController } from '../controllers/managerController.js';
import { authenticate, authorize } from '../middleware/authMiddleware.js';

const router = Router();

/**
 * All routes in this file are protected and require the 'GERENTE' role.
 */
router.use(authenticate);
router.use(authorize(['GERENTE']));

/**
 * RESTAURANT SETTINGS
 */
router.patch('/:restaurantId/settings', ManagerController.updateSettings);

/**
 * STAFF MANAGEMENT
 */
router.post('/:restaurantId/staff', ManagerController.addStaff);
router.get('/:restaurantId/staff', ManagerController.listStaff);

/**
 * MENU MANAGEMENT
 */
router.post('/:restaurantId/menu', ManagerController.createMenuItem);
router.get('/:restaurantId/menu', ManagerController.listMenuItems);

/**
 * TABLE MANAGEMENT
 */
router.post('/:restaurantId/tables', ManagerController.createTable);

/**
 * ANALYTICS
 */
router.get('/:restaurantId/analytics', ManagerController.getAnalytics);

export default router;
