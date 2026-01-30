import type { Request, Response, NextFunction } from 'express';
import db from '../services/dbService.js';
import type { AuthRequest } from '../middleware/authMiddleware.js';
import bcrypt from 'bcryptjs';

export class ManagerController {

    /**
     * Verifica se o usuario logado é gerente do restaurante informado.
     */
    private static async verifyOwnership(userId: number, restaurantId: number) {
        const result = await db.query(
            `SELECT 1 FROM funcionarios_restaurante 
             WHERE id_usuario = $1 AND id_restaurante = $2 AND funcao = 'GERENTE'`,
            [userId, restaurantId]
        );

        if (result.rows.length === 0) {
            throw new Error('Forbidden: Você não tem permissão de gerente para este restaurante.');
        }
    }

    /**
     * Cria um novo restaurante e define o usuario logado como GERENTE.
     */
    static async createRestaurant(req: Request, res: Response, next: NextFunction) {
        console.log('1. Iniciando criacao de restaurante...');

        const {
            nomeFantasia, razaoSocial, cnpj, descricao, categoria,
            logradouro, numero, bairro, cidade, estado, cep,
            latitude, longitude // <--- Adicionado aqui
        } = req.body;

        const userId = (req as AuthRequest).user?.id;

        const client = await db.getClient();

        try {
            await client.query('BEGIN');
            console.log('2. Transação iniciada.');

            // Inserir informacoes do restaurante (Incluindo Lat/Long)
            const insertRestQuery = `
                INSERT INTO restaurantes 
                (nome_fantasia, razao_social, cnpj, descricao, categoria_principal, 
                 logradouro, numero, bairro, cidade, estado, cep, latitude, longitude)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                RETURNING id_restaurante, nome_fantasia
            `;

            const restResult = await client.query(insertRestQuery, [
                nomeFantasia, razaoSocial, cnpj, descricao, categoria,
                logradouro, numero, bairro, cidade, estado, cep,
                latitude || null, longitude || null // <--- Adicionado aqui (envia null se não vier no body)
            ]);

            const newRestaurant = restResult.rows[0];
            console.log('3. Restaurante inserido:', newRestaurant.id_restaurante);

            // Vincular usuario como gerente
            const insertFuncQuery = `
                INSERT INTO funcionarios_restaurante (id_usuario, id_restaurante, funcao)
                VALUES ($1, $2, 'GERENTE')
            `;

            await client.query(insertFuncQuery, [userId, newRestaurant.id_restaurante]);
            console.log('4. Gerente vinculado.');

            await client.query('COMMIT');

            res.status(201).json({
                success: true,
                message: 'Restaurante criado com sucesso!',
                data: newRestaurant
            });

        } catch (error: any) {
            console.error('ERRO na transação:', error);
            await client.query('ROLLBACK');

            if (error.code === '23505') {
                return res.status(400).json({ success: false, message: 'Este CNPJ já está cadastrado.' });
            }

            next(error);
        } finally {
            client.release();
            console.log('5. Conexão liberada.');
        }
    }

    static async getMyRestaurants(req: Request, res: Response, next: NextFunction) {
        try {
            //buscar o id do usuario do token
            const userId = (req as AuthRequest).user?.id;

            if (!userId) {
                return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
            }

            const query = `
                SELECT 
                    r.id_restaurante, 
                    r.nome_fantasia, 
                    r.categoria_principal, 
                    r.cidade,
                    fr.funcao  -- É importante retornar a função para o frontend saber se ele é GERENTE ou GARCOM
                FROM restaurantes r
                JOIN funcionarios_restaurante fr ON r.id_restaurante = fr.id_restaurante
                WHERE fr.id_usuario = $1
                ORDER BY r.criado_em DESC
            `;

            const result = await db.query(query, [userId]);

            res.json({
                success: true,
                count: result.rows.length,
                data: result.rows
            });

        } catch (error) {
            next(error);
        }
    }

    static async updateSettings(req: Request, res: Response, next: NextFunction) {
        try {
            const restaurantId = req.params.restaurantId || req.body.restaurantId;
            const { nomeFantasia, descricao, categoria, tempoEspera } = req.body;
            const userId = (req as AuthRequest).user!.id;

            await ManagerController.verifyOwnership(userId, Number(restaurantId));

            //Atualizacao
            const result = await db.query(
                `UPDATE restaurantes 
                 SET nome_fantasia = COALESCE($1, nome_fantasia), 
                     descricao = COALESCE($2, descricao), 
                     categoria_principal = COALESCE($3, categoria_principal),
                     tempo_espera_medio = COALESCE($4, tempo_espera_medio)
                 WHERE id_restaurante = $5
                 RETURNING *`,
                [nomeFantasia, descricao, categoria, tempoEspera, restaurantId]
            );

            res.json({ success: true, data: result.rows[0] });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Adiciona funcionario pelo email (Cria conta se não existir).
     */
    static async addStaff(req: Request, res: Response, next: NextFunction) {
        const client = await db.getClient();
        try {
            const restaurantId = req.params.restaurantId || req.body.restaurantId;

            const { nome, email, telefone, funcao, senhaInicial } = req.body;

            const userIdLogado = (req as AuthRequest).user!.id;

            //verificar se o usuario e dono do restaurante
            await ManagerController.verifyOwnership(userIdLogado, Number(restaurantId));

            if (!['GARCOM', 'COZINHA', 'BAR', 'GERENTE'].includes(funcao)) {
                return res.status(400).json({ success: false, message: 'Função inválida.' });
            }

            await client.query('BEGIN');

            let idUsuarioFuncionario: number;

            //verifica se existe um usuario com o email informado
            const userExists = await client.query('SELECT id_usuario FROM usuarios WHERE email = $1', [email]);

            if (userExists.rows.length > 0) {
                idUsuarioFuncionario = userExists.rows[0].id_usuario;
            } else {
                // Cria usuario novo para o funcionario do restaurante
                const senhaHash = await bcrypt.hash(senhaInicial || 'Mudar123!', 10);

                const newUser = await client.query(
                    `INSERT INTO usuarios (nome_completo, email, telefone, senha_hash) 
                     VALUES ($1, $2, $3, $4) RETURNING id_usuario`,
                    [nome, email, telefone, senhaHash]
                );
                idUsuarioFuncionario = newUser.rows[0].id_usuario;

                //atribui papel de consumidor
                await client.query(`
                    INSERT INTO usuarios_papeis (id_usuario, id_papel)
                    SELECT $1, id_papel FROM papeis WHERE nome = 'CONSUMIDOR'
                `, [idUsuarioFuncionario]);
            }

            //verifica se o usuario ja trabalha no restaurante
            const checkVinculo = await client.query(
                `SELECT 1 FROM funcionarios_restaurante 
                 WHERE id_usuario = $1 AND id_restaurante = $2`,
                [idUsuarioFuncionario, restaurantId]
            );

            if (checkVinculo.rows.length > 0) {
                throw new Error('Este usuário já faz parte da equipe deste restaurante.');
            }

            //cria o vinculo
            const result = await client.query(
                `INSERT INTO funcionarios_restaurante (id_restaurante, id_usuario, funcao)
                 VALUES ($1, $2, $3)
                 RETURNING id_funcionario, funcao`,
                [restaurantId, idUsuarioFuncionario, funcao]
            );

            await client.query('COMMIT');

            res.status(201).json({ success: true, data: result.rows[0] });

        } catch (error) {
            await client.query('ROLLBACK');
            next(error);
        } finally {
            client.release();
        }
    }

    static async listStaff(req: Request, res: Response, next: NextFunction) {
        try {
            const { restaurantId } = req.params;
            const userId = (req as AuthRequest).user!.id;

            await ManagerController.verifyOwnership(userId, Number(restaurantId));

            const result = await db.query(
                `SELECT fr.id_funcionario, fr.funcao, u.nome_completo, u.email, u.telefone
                 FROM funcionarios_restaurante fr
                 JOIN usuarios u ON fr.id_usuario = u.id_usuario
                 WHERE fr.id_restaurante = $1`,
                [restaurantId]
            );
            res.json({ success: true, data: result.rows });
        } catch (error) {
            next(error);
        }
    }

    static async createMenuItem(req: Request, res: Response, next: NextFunction) {
        const client = await db.getClient();
        try {
            // Pega o ID da URL e os dados do Item do Body
            const restaurantId = req.params.restaurantId || req.body.restaurantId;
            const { nome, descricao, preco, categoria, imagemUrl } = req.body;

            const userId = (req as AuthRequest).user!.id;

            await ManagerController.verifyOwnership(userId, Number(restaurantId));

            await client.query('BEGIN');

            const itemResult = await client.query(
                `INSERT INTO cardapio_itens (id_restaurante, nome, descricao, preco, categoria, imagem_url, disponivel)
                 VALUES ($1, $2, $3, $4, $5, $6, true)
                 RETURNING id_item, nome`,
                [restaurantId, nome, descricao, preco, categoria, imagemUrl]
            );

            await client.query('COMMIT');
            res.status(201).json({ success: true, data: itemResult.rows[0] });
        } catch (error) {
            await client.query('ROLLBACK');
            next(error);
        } finally {
            client.release();
        }
    }

    static async listMenuItems(req: Request, res: Response, next: NextFunction) {
        try {
            const { restaurantId } = req.params;

            const result = await db.query(
                `SELECT * FROM cardapio_itens WHERE id_restaurante = $1 ORDER BY categoria, nome`,
                [restaurantId]
            );
            res.json({ success: true, data: result.rows });
        } catch (error) {
            next(error);
        }
    }

    // --- TABLE MANAGEMENT ---

    static async createTable(req: Request, res: Response, next: NextFunction) {
        try {
            const restaurantId = req.params.restaurantId || req.body.restaurantId;
            const { identifier, capacity } = req.body;
            const userId = (req as AuthRequest).user!.id;

            await ManagerController.verifyOwnership(userId, Number(restaurantId));

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

    static async getAnalytics(req: Request, res: Response, next: NextFunction) {
        try {
            const { restaurantId } = req.params;
            const userId = (req as AuthRequest).user!.id;

            await ManagerController.verifyOwnership(userId, Number(restaurantId));

            const topItems = await db.query(
                `SELECT ci.nome, COUNT(ip.id_item) as vendas
                 FROM itens_pedido ip
                 JOIN cardapio_itens ci ON ip.id_produto = ci.id_item
                 JOIN pedidos p ON ip.id_pedido = p.id_pedido
                 JOIN sessoes s ON p.id_sessao = s.id_sessao
                 WHERE s.id_restaurante = $1
                 GROUP BY ci.nome
                 ORDER BY vendas DESC
                 LIMIT 5`,
                [restaurantId]
            );

            res.json({ success: true, data: { topItems: topItems.rows } });
        } catch (error) {
            next(error);
        }
    }

    static async createIngredient(req: Request, res: Response, next: NextFunction) {
        try {
            const restaurantId = req.params.restaurantId || req.body.restaurantId;

            // Lemos apenas o que sua tabela pede
            const { nome, preco, descricao } = req.body;

            const userId = (req as AuthRequest).user!.id;

            // 1. Segurança
            await ManagerController.verifyOwnership(userId, Number(restaurantId));

            // 2. Insere no Banco
            const result = await db.query(
                `INSERT INTO ingredientes (id_restaurante, nome, preco, descricao)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id_ingrediente, nome, preco, descricao`,
                [
                    restaurantId,
                    nome,
                    preco || 0.00,  // Se não mandar preço, grava 0
                    descricao || '' // Se não mandar descrição, grava vazio
                ]
            );

            res.status(201).json({ success: true, data: result.rows[0] });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Lista todos os ingredientes cadastrados.
     */
    static async listIngredients(req: Request, res: Response, next: NextFunction) {
        try {
            const restaurantId = req.params.restaurantId || req.body.restaurantId;
            const userId = (req as AuthRequest).user!.id;

            // Verifica permissão
            await ManagerController.verifyOwnership(userId, Number(restaurantId));

            const result = await db.query(
                `SELECT * FROM ingredientes WHERE id_restaurante = $1 ORDER BY nome`,
                [restaurantId]
            );

            res.json({ success: true, data: result.rows });
        } catch (error) {
            next(error);
        }
    }

    static async addIngredientToItem(req: Request, res: Response, next: NextFunction) {
        const client = await db.getClient();
        try {
            // Pegamos o ID do Restaurante e do Item da URL
            const restaurantId = req.params.restaurantId || req.body.restaurantId;
            const itemId = req.params.itemId;

            // Pegamos o ID do Ingrediente e detalhes do Body
            const { ingredientId, quantidade, observacoes } = req.body;

            const userId = (req as AuthRequest).user!.id;

            // 1. Segurança: Verifica se é gerente
            await ManagerController.verifyOwnership(userId, Number(restaurantId));

            await client.query('BEGIN');

            // 2. (Opcional mas Recomendado) Verificação de Integridade
            // Verifica se o Item pertence mesmo a esse restaurante para evitar fraudes
            const checkItem = await client.query(
                'SELECT 1 FROM cardapio_itens WHERE id_item = $1 AND id_restaurante = $2',
                [itemId, restaurantId]
            );

            if (checkItem.rows.length === 0) {
                throw new Error('Item não encontrado neste restaurante.');
            }

            // 3. Insere o Vínculo na tabela cardapio_itens_ingredientes
            const result = await client.query(
                `INSERT INTO cardapio_itens_ingredientes (id_item, id_ingrediente, quantidade, observacoes)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id_item_ingrediente, quantidade, observacoes`,
                [itemId, ingredientId, quantidade, observacoes]
            );

            await client.query('COMMIT');
            res.status(201).json({ success: true, data: result.rows[0] });

        } catch (error) {
            await client.query('ROLLBACK');
            next(error);
        } finally {
            client.release();
        }
    }

    /**
     * (Opcional) Lista os ingredientes de um item específico
     */
    static async getIngredientsByItem(req: Request, res: Response, next: NextFunction) {
        try {
            const { itemId } = req.params;

            // Faz um JOIN para trazer o nome do ingrediente junto
            const result = await db.query(
                `SELECT cii.id_item_ingrediente, i.nome, cii.quantidade, cii.observacoes, i.preco as custo_extra
                 FROM cardapio_itens_ingredientes cii
                 JOIN ingredientes i ON cii.id_ingrediente = i.id_ingrediente
                 WHERE cii.id_item = $1`,
                [itemId]
            );

            res.json({ success: true, data: result.rows });
        } catch (error) {
            next(error);
        }
    }
}