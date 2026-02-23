import * as db from '../config/db.js';

export class RestaurantController {
    /**
     * Lista todos os restaurantes ativos.
     */
    static async getAll(req, res) {
        try {
            const result = await db.query(
                `SELECT id_restaurante, nome_fantasia, logradouro, numero, bairro, cidade, estado, categoria_principal, descricao 
                 FROM restaurantes 
                 WHERE ativo = true 
                 ORDER BY nome_fantasia ASC`
            );

            res.json({
                success: true,
                data: result.rows
            });
        } catch (error) {
            console.error('Erro ao buscar restaurantes:', error);
            res.status(500).json({
                success: false,
                error: 'Erro interno ao buscar restaurantes.'
            });
        }
    }

    /**
     * Busca o cardápio de um restaurante específico.
     */
    static async getMenu(req, res) {
        try {
            const { id } = req.params;
            const result = await db.query(
                `SELECT id_item, nome, descricao, preco, ativo 
                 FROM cardapio_itens 
                 WHERE id_restaurante = $1 AND ativo = true 
                 ORDER BY nome ASC`,
                [id]
            );

            res.json({
                success: true,
                data: result.rows
            });
        } catch (error) {
            console.error('Erro ao buscar cardápio:', error);
            res.status(500).json({
                success: false,
                error: 'Erro interno ao buscar cardápio.'
            });
        }
    }
}
