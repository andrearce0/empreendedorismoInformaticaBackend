import * as db from '../config/db.js';

export class AllergenController {
    /**
     * Busca todos os alérgenos cadastrados no banco de dados.
     */
    static async getAllAllergens(req, res) {
        try {
            const result = await db.query(
                'SELECT id_alergeno, nome, descricao FROM alergenos ORDER BY nome ASC'
            );
            
            res.json({
                success: true,
                data: result.rows
            });
        } catch (error) {
            console.error('Erro ao buscar alérgenos:', error);
            res.status(500).json({
                success: false,
                error: 'Erro interno ao buscar alérgenos.'
            });
        }
    }
}
