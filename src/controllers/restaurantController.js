import * as db from '../config/db.js';

export class RestaurantController {
    /**
     * Lista todos os restaurantes ativos para o mapa
     */
    static async listAll(req, res) {
        try {
            const result = await db.query(
                `SELECT id_restaurante, nome_fantasia, latitude, longitude, categoria_principal, descricao 
                 FROM restaurantes 
                 WHERE ativo = true`
            );
            res.json(result.rows);
        } catch (error) {
            console.error('Erro ao listar restaurantes:', error);
        }
    }
    /**
     * Lista o cardápio de um restaurante específico
     */
    static async getMenu(req, res) {
        try {
            const { restaurantId } = req.params;
            const result = await db.query(
                `SELECT id_item, id_restaurante, nome, descricao, preco, ativo 
                 FROM cardapio_itens 
                 WHERE id_restaurante = $1 AND ativo = true
                 ORDER BY nome`,
                [restaurantId]
            );
            res.json(result.rows);
        } catch (error) {
            console.error('Erro ao buscar cardápio:', error);
            res.status(500).json({ error: 'Erro ao buscar o cardápio.' });
        }
    }
}
