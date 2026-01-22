import type { Request, Response, NextFunction } from 'express';
import db from '../services/dbService.js';

/**
 * Controller for Allergen related operations.
 */
export class AllergenController {
    /**
     * List all allergens.
     */
    static async getAll(req: Request, res: Response, next: NextFunction) {
        try {
            const result = await db.query(
                'SELECT id_alergeno as id, nome as name, descricao as description FROM alergenos ORDER BY nome'
            );
            res.json({ success: true, data: result.rows });
        } catch (error) {
            next(error);
        }
    }
}
