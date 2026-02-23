import { Router } from 'express';
import { AllergenController } from '../controllers/allergenController.js';

const router = Router();

// Rota para listar todos os alérgenos
// URL: GET /api/alergenos
router.get('/', AllergenController.getAllAllergens);

export default router;
