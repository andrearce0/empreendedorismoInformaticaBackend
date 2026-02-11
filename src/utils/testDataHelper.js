import * as db from '../config/db.js';

/**
 * Garante que existem dados de teste (Restaurante, Usuário, Sessão e Cardápio).
 * Retorna o ID do restaurante e da sessão para usar nos testes.
 */
export async function ensureTestData() {
    try {
        console.log('🔍 Verificando dados de teste...');

        // 1. Get or Create Restaurante
        let res = await db.query('SELECT id_restaurante FROM restaurantes LIMIT 1');
        let restaurantId;

        if (res.rows.length === 0) {
            console.log('Restaurante não encontrado. Criando um de teste...');
            const insertRes = await db.query(
                "INSERT INTO restaurantes (nome_fantasia, ativo, latitude, longitude, categoria_principal) VALUES ('Restaurante Teste', true, -15.565, -56.053, 'Gourmet') RETURNING id_restaurante"
            );
            restaurantId = insertRes.rows[0].id_restaurante;

            // Configuração de pagamento (opcional, dependendo do seu schema)
            // await db.query(
            //     "INSERT INTO restaurantes_config_pagamento (id_restaurante, permite_pagar_depois) VALUES ($1, true)",
            //     [restaurantId]
            // );
        } else {
            restaurantId = res.rows[0].id_restaurante;
        }

        // 2. Ensure an active session exists for this restaurant
        // We need a user as well
        let userRes = await db.query('SELECT id_usuario FROM usuarios LIMIT 1');
        let userId;

        if (userRes.rows.length === 0) {
            console.log('Usuário não encontrado. Criando usuário de teste...');
            // Senha hash genérica para teste
            const insertUser = await db.query(
                "INSERT INTO usuarios (nome_completo, email, telefone, senha_hash) VALUES ('Usuário Teste', 'teste@teste.com', '11999999999', '$2a$10$X7.X.X.X.X.X.X.X.X.X.X.X') RETURNING id_usuario"
            );
            userId = insertUser.rows[0].id_usuario;
        } else {
            userId = userRes.rows[0].id_usuario;
        }

        // Verifica sessão aberta
        let sessRes = await db.query(
            "SELECT id_sessao FROM sessoes WHERE id_restaurante = $1 AND status = 'ABERTA' LIMIT 1",
            [restaurantId]
        );
        let sessionId;

        if (sessRes.rows.length === 0) {
            console.log('Nenhuma sessão aberta. Criando nova sessão...');
            const insertSess = await db.query(
                "INSERT INTO sessoes (id_restaurante, id_usuario_criador, origem, status) VALUES ($1, $2, 'MAPA', 'ABERTA') RETURNING id_sessao",
                [restaurantId, userId]
            );
            sessionId = insertSess.rows[0].id_sessao;
        } else {
            sessionId = sessRes.rows[0].id_sessao;
        }

        // 3. Ensure menu items exist for this restaurant
        let menuRes = await db.query('SELECT COUNT(*) as count FROM cardapio_itens WHERE id_restaurante = $1', [restaurantId]);

        if (parseInt(menuRes.rows[0].count) === 0) {
            console.log('Cardápio vazio. Criando itens de exemplo...');
            await db.query(
                `INSERT INTO cardapio_itens (id_restaurante, nome, descricao, preco, ativo) VALUES
                ($1, 'Hambúrguer Gourmet', 'Pão brioche, blend 180g, queijo cheddar e bacon.', 35.00, true),
                ($1, 'Pizza Margherita', 'Molho de tomate, mozarela fatiada e manjericão.', 45.00, true),
                ($1, 'Batata Frita Rústica', 'Batatas crocantes com alecrim e sal grosso.', 20.00, true),
                ($1, 'Suco Natural Laranja', 'Suco de laranja fresquinho 300ml.', 12.00, true),
                ($1, 'Espaguete à Carbonara', 'Massa fresca com molho carbonara cremoso.', 38.00, true),
                ($1, 'Salada Caesar', 'Alface romana, croutons, parmesão e molho caesar.', 28.00, true)`,
                [restaurantId]
            );
        }

        console.log(`✅ Dados de teste garantidos. Restaurante ID: ${restaurantId}, Sessão ID: ${sessionId}`);
        return { restaurantId, sessionId };

    } catch (err) {
        console.error('❌ Erro ao gerar dados de teste:', err);
        throw err;
    }
}