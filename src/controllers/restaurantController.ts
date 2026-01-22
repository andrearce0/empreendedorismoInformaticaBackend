import type { Request, Response, NextFunction } from 'express';
import db from '../services/dbService.js';

/**
 * Controller for Restaurant related operations.
 */
export class RestaurantController {
    /**
     * List all active restaurants.
     */
    static async getAll(req: Request, res: Response, next: NextFunction) {
        try {
            const result = await db.query(
                `SELECT r.id_restaurante as id, r.nome_fantasia as "tradeName", r.razao_social as "companyName",
                        r.cnpj, r.descricao as description, r.categoria_principal as "mainCategory",
                        r.cidade as city, r.estado as state,
                        COALESCE(
                            (SELECT json_agg(t) FROM (SELECT id_mesa as id, identificador_mesa as identifier, capacidade FROM mesas WHERE id_restaurante = r.id_restaurante) t),
                            '[]'
                        ) as tables,
                        (SELECT row_to_json(c) FROM (SELECT permite_pagar_antes as "allowsPayBefore", permite_pagar_depois as "allowsPayAfter" FROM restaurantes_config_pagamento WHERE id_restaurante = r.id_restaurante) c) as "paymentConfig"
                 FROM restaurantes r
                 WHERE r.ativo = true`
            );
            res.json({ success: true, data: result.rows });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get a specific restaurant by ID.
     */
    static async getById(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const result = await db.query(
                `SELECT r.id_restaurante as id, r.nome_fantasia as "tradeName", r.descricao as description,
                        COALESCE(
                            (SELECT json_agg(t) FROM (SELECT id_mesa as id, identificador_mesa as identifier, capacidade FROM mesas WHERE id_restaurante = r.id_restaurante) t),
                            '[]'
                        ) as tables,
                        COALESCE(
                            (SELECT json_agg(m) FROM (SELECT id_item as id, nome as name, preco as price FROM cardapio_itens WHERE id_restaurante = r.id_restaurante) m),
                            '[]'
                        ) as "menuItems",
                        (SELECT row_to_json(c) FROM (SELECT permite_pagar_antes as "allowsPayBefore", permite_pagar_depois as "allowsPayAfter" FROM restaurantes_config_pagamento WHERE id_restaurante = r.id_restaurante) c) as "paymentConfig"
                 FROM restaurantes r
                 WHERE r.id_restaurante = $1`,
                [Number(id)]
            );

            const restaurant = result.rows[0];

            if (!restaurant) {
                return res.status(404).json({ success: false, message: 'Restaurant not found' });
            }

            res.json({ success: true, data: restaurant });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Create a new restaurant.
     */
    static async create(req: Request, res: Response, next: NextFunction) {
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');
            const { tradeName, cnpj, mainCategory, city, state } = req.body;

            const restaurantResult = await client.query(
                `INSERT INTO restaurantes (nome_fantasia, cnpj, categoria_principal, cidade, estado)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING id_restaurante as id, nome_fantasia as "tradeName"`,
                [tradeName, cnpj, mainCategory, city, state]
            );

            const newRestaurant = restaurantResult.rows[0];

            // Create default config
            await client.query(
                `INSERT INTO restaurantes_config_pagamento (id_restaurante) VALUES ($1)`,
                [newRestaurant.id]
            );

            await client.query('COMMIT');
            res.status(201).json({ success: true, data: newRestaurant });
        } catch (error) {
            await client.query('ROLLBACK');
            next(error);
        } finally {
            client.release();
        }
    }
}
