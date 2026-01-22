import type { Request, Response, NextFunction } from 'express';
import db from '../services/dbService.js';

/**
 * Controller for Administrative/Management operations.
 * Most methods expect a restaurantId to be provided, usually verified by middleware.
 */
export class ManagerController {

    // --- RESTAURANT SETTINGS ---

    /**
     * Update restaurant configuration and policies.
     */
    static async updateSettings(req: Request, res: Response, next: NextFunction) {
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');
            const { restaurantId } = req.params;
            const {
                tradeName, description, mainCategory,
                allowsPayBefore, allowsPayAfter, allowsBoth,
                reserva_mesa_paga, reserva_mesa_gratis,
                taxa_servico_percentual
            } = req.body;

            await client.query(
                `UPDATE restaurantes SET nome_fantasia = $1, descricao = $2, categoria_principal = $3, atualizado_em = NOW()
                 WHERE id_restaurante = $4`,
                [tradeName, description, mainCategory, Number(restaurantId)]
            );

            await client.query(
                `UPDATE restaurantes_config_pagamento SET
                    permite_pagar_antes = $1, permite_pagar_depois = $2, permite_ambos = $3,
                    reserva_mesa_paga = $4, reserva_mesa_gratis = $5, taxa_servico_percentual = $6
                 WHERE id_restaurante = $7`,
                [allowsPayBefore, allowsPayAfter, allowsBoth, reserva_mesa_paga, reserva_mesa_gratis, taxa_servico_percentual, Number(restaurantId)]
            );

            const result = await client.query(
                `SELECT r.*, row_to_json(c) as "paymentConfig"
                 FROM restaurantes r
                 JOIN restaurantes_config_pagamento c ON r.id_restaurante = c.id_restaurante
                 WHERE r.id_restaurante = $1`,
                [Number(restaurantId)]
            );

            await client.query('COMMIT');
            res.json({ success: true, data: result.rows[0] });
        } catch (error) {
            await client.query('ROLLBACK');
            next(error);
        } finally {
            client.release();
        }
    }

    // --- STAFF MANAGEMENT ---

    /**
     * Add a staff member to the restaurant.
     */
    static async addStaff(req: Request, res: Response, next: NextFunction) {
        try {
            const { restaurantId } = req.params;
            const { userId, role } = req.body; // role: GARCOM, GERENTE, COZINHA, BAR

            const result = await db.query(
                `INSERT INTO funcionarios_restaurante (id_restaurante, id_usuario, funcao)
                 VALUES ($1, $2, $3)
                 RETURNING id_funcionario as id, id_restaurante as "restaurantId", id_usuario as "userId", funcao as role`,
                [Number(restaurantId), Number(userId), role]
            );

            res.status(201).json({ success: true, data: result.rows[0] });
        } catch (error) {
            next(error);
        }
    }

    /**
     * List all staff of a restaurant.
     */
    static async listStaff(req: Request, res: Response, next: NextFunction) {
        try {
            const { restaurantId } = req.params;
            const result = await db.query(
                `SELECT fr.id_funcionario as id, fr.funcao as role,
                        json_build_object('id', u.id_usuario, 'fullName', u.nome_completo, 'email', u.email) as user
                 FROM funcionarios_restaurante fr
                 JOIN usuarios u ON fr.id_usuario = u.id_usuario
                 WHERE fr.id_restaurante = $1`,
                [Number(restaurantId)]
            );
            res.json({ success: true, data: result.rows });
        } catch (error) {
            next(error);
        }
    }

    // --- MENU MANAGEMENT ---

    /**
     * Create a new menu item.
     */
    static async createMenuItem(req: Request, res: Response, next: NextFunction) {
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');
            const { restaurantId } = req.params;
            const { name, description, price, ingredients } = req.body;

            const itemResult = await client.query(
                `INSERT INTO cardapio_itens (id_restaurante, nome, descricao, preco)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id_item as id, nome, preco`,
                [Number(restaurantId), name, description, price]
            );

            const newItem = itemResult.rows[0];

            if (ingredients && ingredients.length > 0) {
                for (const ing of ingredients) {
                    await client.query(
                        `INSERT INTO cardapio_itens_ingredientes (id_item, id_ingrediente, quantidade, observacoes)
                         VALUES ($1, $2, $3, $4)`,
                        [newItem.id, ing.ingredientId, ing.quantity, ing.notes]
                    );
                }
            }

            await client.query('COMMIT');
            res.status(201).json({ success: true, data: newItem });
        } catch (error) {
            await client.query('ROLLBACK');
            next(error);
        } finally {
            client.release();
        }
    }

    /**
     * List menu items for the restaurant.
     */
    static async listMenuItems(req: Request, res: Response, next: NextFunction) {
        try {
            const { restaurantId } = req.params;
            const result = await db.query(
                `SELECT mi.id_item as id, mi.nome as name, mi.descricao as description, mi.preco as price,
                        COALESCE(
                            (SELECT json_agg(json_build_object('id', mii.id_item_ingrediente, 'quantity', mii.quantidade, 'ingredient', i.*))
                             FROM cardapio_itens_ingredientes mii
                             JOIN ingredientes i ON mii.id_ingrediente = i.id_ingrediente
                             WHERE mii.id_item = mi.id_item),
                            '[]'
                        ) as ingredients
                 FROM cardapio_itens mi
                 WHERE mi.id_restaurante = $1`,
                [Number(restaurantId)]
            );
            res.json({ success: true, data: result.rows });
        } catch (error) {
            next(error);
        }
    }

    // --- TABLE MANAGEMENT ---

    /**
     * Add a physical table to the restaurant.
     */
    static async createTable(req: Request, res: Response, next: NextFunction) {
        try {
            const { restaurantId } = req.params;
            const { identifier, capacity } = req.body;

            const result = await db.query(
                `INSERT INTO mesas (id_restaurante, identificador_mesa, capacidade)
                 VALUES ($1, $2, $3)
                 RETURNING id_mesa as id, identificador_mesa as identifier, capacidade`,
                [Number(restaurantId), identifier, capacity]
            );

            res.status(201).json({ success: true, data: result.rows[0] });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get basic analytics for the restaurant.
     */
    static async getAnalytics(req: Request, res: Response, next: NextFunction) {
        try {
            const { restaurantId } = req.params;

            // Top 5 most ordered items
            const topItemsResult = await db.query(
                `SELECT pi.id_item as "menuItemId", COUNT(pi.id_pedido_item) as count
                 FROM pedidos_itens pi
                 JOIN pedidos p ON pi.id_pedido = p.id_pedido
                 JOIN sessoes s ON p.id_sessao = s.id_sessao
                 WHERE s.id_restaurante = $1
                 GROUP BY pi.id_item
                 ORDER BY count DESC
                 LIMIT 5`,
                [Number(restaurantId)]
            );

            // Busy times (sessions per day of week)
            const sessionsResult = await db.query(
                `SELECT criado_em as "createdAt" FROM sessoes WHERE id_restaurante = $1`,
                [Number(restaurantId)]
            );

            const dayStats = sessionsResult.rows.reduce((acc: any, s: any) => {
                const day = new Date(s.createdAt).toLocaleDateString('pt-BR', { weekday: 'long' });
                acc[day] = (acc[day] || 0) + 1;
                return acc;
            }, {});

            res.json({
                success: true,
                data: {
                    topItems: topItemsResult.rows,
                    busyDays: dayStats
                }
            });
        } catch (error) {
            next(error);
        }
    }
}
