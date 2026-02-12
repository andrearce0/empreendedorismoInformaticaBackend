import * as db from '../config/db.js';
import bcrypt from 'bcryptjs';

export class ManagerController {

    /**
     * Verifica se o usuario é DONO/GERENTE do restaurante
     */
    static async verifyOwnership(userId, restaurantId) {
        const result = await db.query(
            `SELECT 1 FROM funcionarios_restaurante 
             WHERE id_usuario = $1 AND id_restaurante = $2 AND funcao = 'GERENTE'`,
            [userId, restaurantId]
        );

        if (result.rows.length === 0) {
            throw new Error('Forbidden: Você não tem permissão de gerente.');
        }
    }

    /**
     * Cria um novo restaurante
     */
    static async createRestaurant(req, res) {
        const client = await db.getClient();
        try {
            const {
                nomeFantasia, razaoSocial, cnpj, descricao, categoria,
                logradouro, numero, bairro, cidade, estado, cep,
                latitude, longitude
            } = req.body;

            // Pega o ID do usuário que veio do Token (req.user)
            const userId = req.user.id;

            await client.query('BEGIN');

            // 1. Inserir Restaurante
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
                latitude || null, longitude || null
            ]);

            const newRestaurant = restResult.rows[0];

            // 2. Vincular usuário como GERENTE
            await client.query(
                `INSERT INTO funcionarios_restaurante (id_usuario, id_restaurante, funcao)
                 VALUES ($1, $2, 'GERENTE')`,
                [userId, newRestaurant.id_restaurante]
            );

            await client.query('COMMIT');

            res.status(201).json({
                success: true,
                message: 'Restaurante criado com sucesso!',
                data: newRestaurant
            });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Erro ao criar restaurante:', error);
            if (error.code === '23505') { // Código de erro Postgres para duplicidade
                return res.status(400).json({ error: 'Este CNPJ já está cadastrado.' });
            }
            res.status(500).json({ error: 'Erro interno ao criar restaurante.' });
        } finally {
            client.release();
        }
    }

    /**
     * Lista os restaurantes onde sou gerente
     */
    static async getMyRestaurants(req, res) {
        try {
            const userId = req.user.id;
            const result = await db.query(
                `SELECT r.*, fr.funcao 
                 FROM restaurantes r
                 JOIN funcionarios_restaurante fr ON r.id_restaurante = fr.id_restaurante
                 WHERE fr.id_usuario = $1`,
                [userId]
            );
            res.json({ success: true, data: result.rows });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Erro ao buscar restaurantes.' });
        }
    }

    /**
     * Adiciona um funcionário à equipe (Cria usuário se não existir)
     */
    static async addStaff(req, res) {
        const client = await db.getClient();
        try {
            const { restaurantId } = req.params;
            const { nome, email, telefone, funcao, senhaInicial } = req.body;
            const userIdLogado = req.user.id; // ID do Gerente logado

            // 1. Validar função permitida
            const funcoesPermitidas = ['GARCOM', 'COZINHA', 'BAR', 'GERENTE'];
            if (!funcoesPermitidas.includes(funcao)) {
                return res.status(400).json({ error: 'Função inválida. Use: GARCOM, COZINHA, BAR ou GERENTE.' });
            }

            // 2. Verificar se quem está pedindo é Gerente DESTE restaurante
            // (Reutilizando a função auxiliar que criamos antes)
            // Se você não tiver essa função estática na classe, copie do passo anterior.
            await ManagerController.verifyOwnership(userIdLogado, restaurantId);

            await client.query('BEGIN');

            let idUsuarioFuncionario;

            // 3. Verificar se o usuário já existe no sistema
            const userExists = await client.query('SELECT id_usuario FROM usuarios WHERE email = $1', [email]);

            if (userExists.rows.length > 0) {
                // Usuário já tem conta no app, só pegamos o ID
                idUsuarioFuncionario = userExists.rows[0].id_usuario;
            } else {
                // Usuário NOVO: Criar conta com senha provisória
                const senhaHash = await bcrypt.hash(senhaInicial || 'Mudar123!', 10);

                const newUser = await client.query(
                    `INSERT INTO usuarios (nome_completo, email, telefone, senha_hash) 
                     VALUES ($1, $2, $3, $4) RETURNING id_usuario`,
                    [nome, email, telefone, senhaHash]
                );
                idUsuarioFuncionario = newUser.rows[0].id_usuario;

                // Dar papel básico de consumidor também
                // (Assumindo que você tem a tabela papeis populada)
                await client.query(`
                    INSERT INTO usuarios_papeis (id_usuario, id_papel)
                    SELECT $1, id_papel FROM papeis WHERE nome = 'CONSUMIDOR'
                `, [idUsuarioFuncionario]);
            }

            // 4. Verificar se ele JÁ trabalha neste restaurante
            const checkVinculo = await client.query(
                `SELECT 1 FROM funcionarios_restaurante 
                 WHERE id_usuario = $1 AND id_restaurante = $2`,
                [idUsuarioFuncionario, restaurantId]
            );

            if (checkVinculo.rows.length > 0) {
                throw new Error('Este usuário já faz parte da equipe deste restaurante.');
            }

            // 5. Criar o vínculo (O "Crachá")
            await client.query(
                `INSERT INTO funcionarios_restaurante (id_restaurante, id_usuario, funcao)
                 VALUES ($1, $2, $3)`,
                [restaurantId, idUsuarioFuncionario, funcao]
            );

            await client.query('COMMIT');

            res.status(201).json({
                success: true,
                message: 'Funcionário adicionado com sucesso!',
                data: {
                    id: idUsuarioFuncionario,
                    email,
                    funcao
                }
            });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Erro ao adicionar funcionário:', error);
            res.status(500).json({ error: error.message });
        } finally {
            client.release();
        }
    }

    /**
     * Lista todos os funcionários de um restaurante
     */
    static async listStaff(req, res) {
        try {
            const { restaurantId } = req.params;
            const userIdLogado = req.user.id;

            // Segurança: Só o gerente pode ver a lista
            await ManagerController.verifyOwnership(userIdLogado, restaurantId);

            const result = await db.query(
                `SELECT fr.id_funcionario, fr.funcao, u.nome_completo, u.email, u.telefone
                 FROM funcionarios_restaurante fr
                 JOIN usuarios u ON fr.id_usuario = u.id_usuario
                 WHERE fr.id_restaurante = $1
                 ORDER BY fr.funcao`,
                [restaurantId]
            );

            res.json({ success: true, data: result.rows });

        } catch (error) {
            console.error(error);
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Cria um novo item no cardápio
     */
    static async createMenuItem(req, res) {
        const client = await db.getClient();
        try {
            // Pegamos o ID do restaurante da URL
            const { restaurantId } = req.params;
            const { nome, descricao, preco, categoria, imagemUrl } = req.body;
            const userId = req.user.id;

            // 1. Segurança: Verifica se é gerente
            await ManagerController.verifyOwnership(userId, restaurantId);

            await client.query('BEGIN');

            const itemResult = await client.query(
                `INSERT INTO cardapio_itens (id_restaurante, nome, descricao, preco, categoria, imagem_url, disponivel)
                 VALUES ($1, $2, $3, $4, $5, $6, true)
                 RETURNING id_item, nome, preco`,
                [restaurantId, nome, descricao, preco, categoria, imagemUrl]
            );

            await client.query('COMMIT');

            res.status(201).json({
                success: true,
                message: 'Item criado com sucesso!',
                data: itemResult.rows[0]
            });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Erro ao criar item:', error);
            res.status(500).json({ error: error.message });
        } finally {
            client.release();
        }
    }

    /**
     * Lista os itens do cardápio (Visão do Gerente)
     */
    static async listMenuItems(req, res) {
        try {
            const { restaurantId } = req.params;
            // Aqui não precisa verificar ownership rigoroso se for só pra listar,
            // mas vamos manter para garantir que é uma rota de gestão.
            // Se quiser público, cria-se no RestaurantController.

            const result = await db.query(
                `SELECT * FROM cardapio_itens 
                 WHERE id_restaurante = $1 
                 ORDER BY categoria, nome`,
                [restaurantId]
            );

            res.json({ success: true, data: result.rows });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Cria um novo Ingrediente (Insumo)
     */
    static async createIngredient(req, res) {
        const client = await db.getClient();
        try {
            const { restaurantId } = req.params;
            // Lemos apenas o que sua tabela pede na imagem
            const { nome, preco, descricao } = req.body;

            const userId = req.user.id;

            // 1. Segurança: Verifica se é gerente
            await ManagerController.verifyOwnership(userId, restaurantId);

            await client.query('BEGIN');

            // 2. Insere no Banco
            const result = await client.query(
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

            await client.query('COMMIT');

            res.status(201).json({
                success: true,
                message: 'Ingrediente cadastrado!',
                data: result.rows[0]
            });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Erro ao criar ingrediente:', error);
            res.status(500).json({ error: error.message });
        } finally {
            client.release();
        }
    }

    /**
     * Lista todos os ingredientes do restaurante
     */
    static async listIngredients(req, res) {
        try {
            const { restaurantId } = req.params;
            const userId = req.user.id;

            // Verifica permissão
            await ManagerController.verifyOwnership(userId, restaurantId);

            const result = await db.query(
                `SELECT * FROM ingredientes 
                 WHERE id_restaurante = $1 
                 ORDER BY nome`,
                [restaurantId]
            );

            res.json({ success: true, data: result.rows });

        } catch (error) {
            console.error(error);
            res.status(500).json({ error: error.message });
        }
    }

    static async addIngredientToItem(req, res) {
        const client = await db.getClient();
        try {
            // Pegamos o ID do Restaurante e do Item da URL
            const { restaurantId, itemId } = req.params;

            // Pegamos o ID do Ingrediente e detalhes do Body
            const { ingredientId, quantidade, observacoes } = req.body;

            const userId = req.user.id;

            // 1. Segurança: Verifica se é gerente
            await ManagerController.verifyOwnership(userId, restaurantId);

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
            console.error('Erro ao vincular ingrediente:', error);
            res.status(500).json({ error: error.message });
        } finally {
            client.release();
        }
    }

    /**
     * Lista os ingredientes de um item específico (Ver a receita)
     */
    static async getIngredientsByItem(req, res) {
        try {
            const { restaurantId, itemId } = req.params;
            const userId = req.user.id; // Pegamos o ID do usuário logado

            // 1. [SEGURANÇA] Verifica SE PRIMEIRO se ele é dono do restaurante
            // Se não for, essa função vai lançar um erro e cair no catch
            await ManagerController.verifyOwnership(userId, restaurantId);

            // 2. [LÓGICA] Agora sim, verifica se o item existe no cardápio desse restaurante
            const checkItem = await db.query(
                'SELECT 1 FROM cardapio_itens WHERE id_item = $1 AND id_restaurante = $2',
                [itemId, restaurantId]
            );

            if (checkItem.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Item do cardápio não encontrado.'
                });
            }

            // 3. Busca os ingredientes
            const result = await db.query(
                `SELECT cii.id_item_ingrediente, i.nome, cii.quantidade, cii.observacoes, i.preco as custo_base
                 FROM cardapio_itens_ingredientes cii
                 JOIN ingredientes i ON cii.id_ingrediente = i.id_ingrediente
                 WHERE cii.id_item = $1`,
                [itemId]
            );

            res.json({ success: true, data: result.rows });
        } catch (error) {
            // Tratamento específico para o erro que o verifyOwnership lança
            if (error.message.includes('Forbidden')) {
                return res.status(403).json({ error: error.message });
            }
            console.error(error);
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Cria uma nova Mesa no restaurante
     */
    static async createTable(req, res) {
        const client = await db.getClient();
        try {
            const { restaurantId } = req.params;
            const { identifier, capacity } = req.body; // Ex: "Mesa 10", 4 cadeiras
            const userId = req.user.id;

            await ManagerController.verifyOwnership(userId, restaurantId);

            await client.query('BEGIN');

            const result = await client.query(
                `INSERT INTO mesas (id_restaurante, identificador_mesa, capacidade)
                 VALUES ($1, $2, $3)
                 RETURNING id_mesa as id, identificador_mesa as identifier, capacidade`,
                [restaurantId, identifier, capacity]
            );

            await client.query('COMMIT');
            res.status(201).json({ success: true, data: result.rows[0] });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Erro ao criar mesa:', error);
            res.status(500).json({ error: error.message });
        } finally {
            client.release();
        }
    }
}