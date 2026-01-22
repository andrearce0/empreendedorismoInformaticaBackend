-- =====================================================
-- Script SQL Completo - Sistema de Gestão de Restaurantes
-- PostgreSQL
-- =====================================================

-- Remover tabelas existentes (em ordem reversa de dependências)
DROP TABLE IF EXISTS funcionarios_restaurante CASCADE;
DROP TABLE IF EXISTS taxas_transacao CASCADE;
DROP TABLE IF EXISTS pagamentos_formas CASCADE;
DROP TABLE IF EXISTS pagamentos_divisoes CASCADE;
DROP TABLE IF EXISTS pagamentos CASCADE;
DROP TABLE IF EXISTS cozinha_filas CASCADE;
DROP TABLE IF EXISTS pedidos_status_historico CASCADE;
DROP TABLE IF EXISTS pedidos_itens CASCADE;
DROP TABLE IF EXISTS pedidos CASCADE;
DROP TABLE IF EXISTS reservas_itens CASCADE;
DROP TABLE IF EXISTS reservas CASCADE;
DROP TABLE IF EXISTS combos_itens CASCADE;
DROP TABLE IF EXISTS combos CASCADE;
DROP TABLE IF EXISTS cardapio_itens_ingredientes CASCADE;
DROP TABLE IF EXISTS cardapio_itens CASCADE;
DROP TABLE IF EXISTS ingredientes_alergenos CASCADE;
DROP TABLE IF EXISTS ingredientes CASCADE;
DROP TABLE IF EXISTS alergenos CASCADE;
DROP TABLE IF EXISTS sessoes CASCADE;
DROP TABLE IF EXISTS mesas CASCADE;
DROP TABLE IF EXISTS restaurantes_config_pagamento CASCADE;
DROP TABLE IF EXISTS restaurantes CASCADE;
DROP TABLE IF EXISTS usuarios_papeis CASCADE;
DROP TABLE IF EXISTS papeis CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;

-- =====================================================
-- TABELA: usuarios
-- =====================================================
CREATE TABLE usuarios (
    id_usuario SERIAL PRIMARY KEY,
    nome_completo VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    telefone VARCHAR(20) NOT NULL,
    senha_hash VARCHAR(255) NOT NULL,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP NULL DEFAULT NULL,
    ativo BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_usuarios_telefone ON usuarios(telefone);

-- =====================================================
-- TABELA: papeis
-- =====================================================
CREATE TABLE papeis (
    id_papel SERIAL PRIMARY KEY,
    nome VARCHAR(50) NOT NULL UNIQUE,
    descricao VARCHAR(255) NULL
);

CREATE INDEX idx_papeis_nome ON papeis(nome);

-- Inserir papéis padrão
INSERT INTO papeis (nome, descricao) VALUES
('CONSUMIDOR', 'Usuário cliente do aplicativo'),
('GARCOM', 'Funcionário responsável por atendimento'),
('GERENTE', 'Gerente do restaurante com permissões administrativas'),
('COZINHA', 'Funcionário da cozinha responsável pelo preparo');

-- =====================================================
-- TABELA: usuarios_papeis
-- =====================================================
CREATE TABLE usuarios_papeis (
    id_usuario_papel SERIAL PRIMARY KEY,
    id_usuario INTEGER NOT NULL,
    id_papel INTEGER NOT NULL,
    id_restaurante INTEGER NULL,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    FOREIGN KEY (id_papel) REFERENCES papeis(id_papel) ON DELETE CASCADE,
    CONSTRAINT uk_usuario_papel_restaurante UNIQUE (id_usuario, id_papel, id_restaurante)
);

CREATE INDEX idx_usuarios_papeis_usuario ON usuarios_papeis(id_usuario);
CREATE INDEX idx_usuarios_papeis_papel ON usuarios_papeis(id_papel);
CREATE INDEX idx_usuarios_papeis_restaurante ON usuarios_papeis(id_restaurante);

-- =====================================================
-- TABELA: restaurantes
-- =====================================================
CREATE TABLE restaurantes (
    id_restaurante SERIAL PRIMARY KEY,
    nome_fantasia VARCHAR(150) NOT NULL,
    razao_social VARCHAR(150) NULL,
    cnpj VARCHAR(20) NULL UNIQUE,
    descricao TEXT NULL,
    categoria_principal VARCHAR(50) NULL,
    logradouro VARCHAR(200) NULL,
    numero VARCHAR(10) NULL,
    bairro VARCHAR(100) NULL,
    cidade VARCHAR(100) NULL,
    estado VARCHAR(2) NULL,
    cep VARCHAR(10) NULL,
    latitude DECIMAL(9,6) NULL,
    longitude DECIMAL(11,6) NULL,
    destaque_nivel VARCHAR(20) NULL DEFAULT 'nenhum',
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP NULL DEFAULT NULL,
    ativo BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX idx_restaurantes_cnpj ON restaurantes(cnpj);
CREATE INDEX idx_restaurantes_categoria ON restaurantes(categoria_principal);
CREATE INDEX idx_restaurantes_cidade ON restaurantes(cidade);
CREATE INDEX idx_restaurantes_estado ON restaurantes(estado);
CREATE INDEX idx_restaurantes_coordenadas ON restaurantes(latitude, longitude);
CREATE INDEX idx_restaurantes_destaque ON restaurantes(destaque_nivel);

-- =====================================================
-- TABELA: restaurantes_config_pagamento
-- =====================================================
CREATE TABLE restaurantes_config_pagamento (
    id_restaurante INTEGER PRIMARY KEY,
    permite_pagar_antes BOOLEAN NOT NULL DEFAULT false,
    permite_pagar_depois BOOLEAN NOT NULL DEFAULT true,
    permite_ambos BOOLEAN NOT NULL DEFAULT false,
    reserva_mesa_paga BOOLEAN NOT NULL DEFAULT false,
    reserva_mesa_gratis BOOLEAN NOT NULL DEFAULT true,
    prazo_cancelamento_reserva_horas INTEGER NOT NULL DEFAULT 2,
    prazo_divisao_sessao_minutos INTEGER NOT NULL DEFAULT 15,
    taxa_servico_percentual DECIMAL(5,2) NULL,
    taxa_plataforma_percentual DECIMAL(5,2) NOT NULL DEFAULT 1.00,
    FOREIGN KEY (id_restaurante) REFERENCES restaurantes(id_restaurante) ON DELETE CASCADE,
    CONSTRAINT chk_prazo_cancelamento CHECK (prazo_cancelamento_reserva_horas BETWEEN 1 AND 24),
    CONSTRAINT chk_prazo_divisao CHECK (prazo_divisao_sessao_minutos BETWEEN 5 AND 60),
    CONSTRAINT chk_taxa_servico CHECK (taxa_servico_percentual IS NULL OR (taxa_servico_percentual BETWEEN 0.00 AND 20.00)),
    CONSTRAINT chk_taxa_plataforma CHECK (taxa_plataforma_percentual BETWEEN 0.00 AND 5.00)
);

-- Adicionar FK de usuarios_papeis para restaurantes
ALTER TABLE usuarios_papeis 
ADD CONSTRAINT fk_usuarios_papeis_restaurante 
FOREIGN KEY (id_restaurante) REFERENCES restaurantes(id_restaurante) ON DELETE CASCADE;

-- =====================================================
-- TABELA: mesas
-- =====================================================
CREATE TABLE mesas (
    id_mesa SERIAL PRIMARY KEY,
    id_restaurante INTEGER NOT NULL,
    identificador_mesa VARCHAR(20) NOT NULL,
    capacidade INTEGER NULL,
    ativa BOOLEAN NOT NULL DEFAULT true,
    FOREIGN KEY (id_restaurante) REFERENCES restaurantes(id_restaurante) ON DELETE CASCADE,
    CONSTRAINT uk_mesa_restaurante UNIQUE (id_restaurante, identificador_mesa),
    CONSTRAINT chk_capacidade CHECK (capacidade IS NULL OR capacidade BETWEEN 1 AND 20)
);

CREATE INDEX idx_mesas_restaurante ON mesas(id_restaurante);
CREATE INDEX idx_mesas_identificador ON mesas(identificador_mesa);

-- =====================================================
-- TABELA: sessoes
-- =====================================================
CREATE TABLE sessoes (
    id_sessao SERIAL PRIMARY KEY,
    id_restaurante INTEGER NOT NULL,
    id_mesa INTEGER NULL,
    id_usuario_criador INTEGER NOT NULL,
    origem VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    inicio_previsto TIMESTAMP NULL,
    inicio_efetivo TIMESTAMP NULL,
    fim_efetivo TIMESTAMP NULL,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_restaurante) REFERENCES restaurantes(id_restaurante) ON DELETE CASCADE,
    FOREIGN KEY (id_mesa) REFERENCES mesas(id_mesa) ON DELETE SET NULL,
    FOREIGN KEY (id_usuario_criador) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    CONSTRAINT chk_origem CHECK (origem IN ('MAPA', 'QRCODE', 'RESERVA')),
    CONSTRAINT chk_status_sessao CHECK (status IN ('ABERTA', 'EM_ANDAMENTO', 'FECHADA', 'CANCELADA'))
);

CREATE INDEX idx_sessoes_restaurante ON sessoes(id_restaurante);
CREATE INDEX idx_sessoes_mesa ON sessoes(id_mesa);
CREATE INDEX idx_sessoes_usuario ON sessoes(id_usuario_criador);
CREATE INDEX idx_sessoes_status ON sessoes(status);

-- =====================================================
-- TABELA: alergenos
-- =====================================================
CREATE TABLE alergenos (
    id_alergeno SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL UNIQUE,
    descricao VARCHAR(255) NULL
);

-- Inserir alérgenos comuns
INSERT INTO alergenos (nome, descricao) VALUES
('Glúten', 'Presente em trigo, centeio, cevada'),
('Lactose', 'Açúcar do leite'),
('Amendoim', 'Nozes e derivados'),
('Frutos do Mar', 'Camarão, peixe, moluscos'),
('Ovos', 'Ovos e derivados'),
('Soja', 'Soja e derivados'),
('Nozes', 'Castanhas, amêndoas, etc.');

-- =====================================================
-- TABELA: ingredientes
-- =====================================================
CREATE TABLE ingredientes (
    id_ingrediente SERIAL PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    preco DECIMAL(10,2) NULL,
    descricao VARCHAR(255) NULL,
    CONSTRAINT chk_preco_ingrediente CHECK (preco IS NULL OR preco >= 0.00)
);

CREATE INDEX idx_ingredientes_nome ON ingredientes(nome);

-- =====================================================
-- TABELA: ingredientes_alergenos
-- =====================================================
CREATE TABLE ingredientes_alergenos (
    id_ingrediente INTEGER NOT NULL,
    id_alergeno INTEGER NOT NULL,
    PRIMARY KEY (id_ingrediente, id_alergeno),
    FOREIGN KEY (id_ingrediente) REFERENCES ingredientes(id_ingrediente) ON DELETE CASCADE,
    FOREIGN KEY (id_alergeno) REFERENCES alergenos(id_alergeno) ON DELETE CASCADE
);

CREATE INDEX idx_ingred_alergenos_ingrediente ON ingredientes_alergenos(id_ingrediente);
CREATE INDEX idx_ingred_alergenos_alergeno ON ingredientes_alergenos(id_alergeno);

-- =====================================================
-- TABELA: cardapio_itens
-- =====================================================
CREATE TABLE cardapio_itens (
    id_item SERIAL PRIMARY KEY,
    id_restaurante INTEGER NOT NULL,
    nome VARCHAR(150) NOT NULL,
    descricao TEXT NULL,
    preco DECIMAL(10,2) NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT true,
    FOREIGN KEY (id_restaurante) REFERENCES restaurantes(id_restaurante) ON DELETE CASCADE,
    CONSTRAINT chk_preco_item CHECK (preco > 0.00)
);

CREATE INDEX idx_cardapio_restaurante ON cardapio_itens(id_restaurante);
CREATE INDEX idx_cardapio_ativo ON cardapio_itens(ativo);

-- =====================================================
-- TABELA: cardapio_itens_ingredientes
-- =====================================================
CREATE TABLE cardapio_itens_ingredientes (
    id_item_ingrediente SERIAL PRIMARY KEY,
    id_item INTEGER NOT NULL,
    id_ingrediente INTEGER NOT NULL,
    quantidade VARCHAR(50) NULL,
    observacoes VARCHAR(255) NULL,
    FOREIGN KEY (id_item) REFERENCES cardapio_itens(id_item) ON DELETE CASCADE,
    FOREIGN KEY (id_ingrediente) REFERENCES ingredientes(id_ingrediente) ON DELETE CASCADE
);

CREATE INDEX idx_item_ingred_item ON cardapio_itens_ingredientes(id_item);
CREATE INDEX idx_item_ingred_ingrediente ON cardapio_itens_ingredientes(id_ingrediente);

-- =====================================================
-- TABELA: combos
-- =====================================================
CREATE TABLE combos (
    id_combo SERIAL PRIMARY KEY,
    id_restaurante INTEGER NOT NULL,
    nome VARCHAR(150) NOT NULL,
    descricao TEXT NULL,
    preco_total DECIMAL(10,2) NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT true,
    FOREIGN KEY (id_restaurante) REFERENCES restaurantes(id_restaurante) ON DELETE CASCADE,
    CONSTRAINT chk_preco_combo CHECK (preco_total > 0.00)
);

CREATE INDEX idx_combos_restaurante ON combos(id_restaurante);
CREATE INDEX idx_combos_ativo ON combos(ativo);

-- =====================================================
-- TABELA: combos_itens
-- =====================================================
CREATE TABLE combos_itens (
    id_combo_item SERIAL PRIMARY KEY,
    id_combo INTEGER NOT NULL,
    id_item INTEGER NOT NULL,
    quantidade INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (id_combo) REFERENCES combos(id_combo) ON DELETE CASCADE,
    FOREIGN KEY (id_item) REFERENCES cardapio_itens(id_item) ON DELETE CASCADE,
    CONSTRAINT chk_quantidade_combo CHECK (quantidade >= 1)
);

CREATE INDEX idx_combos_itens_combo ON combos_itens(id_combo);
CREATE INDEX idx_combos_itens_item ON combos_itens(id_item);

-- =====================================================
-- TABELA: reservas
-- =====================================================
CREATE TABLE reservas (
    id_reserva SERIAL PRIMARY KEY,
    id_restaurante INTEGER NOT NULL,
    id_mesa INTEGER NULL,
    id_usuario INTEGER NOT NULL,
    tipo VARCHAR(20) NOT NULL,
    data_hora_reserva TIMESTAMP NOT NULL,
    data_hora_limite_cancelamento TIMESTAMP NOT NULL,
    status VARCHAR(20) NOT NULL,
    paga_antecipadamente BOOLEAN NOT NULL DEFAULT false,
    valor_total_previsto DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    valor_pago DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    FOREIGN KEY (id_restaurante) REFERENCES restaurantes(id_restaurante) ON DELETE CASCADE,
    FOREIGN KEY (id_mesa) REFERENCES mesas(id_mesa) ON DELETE SET NULL,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    CONSTRAINT chk_tipo_reserva CHECK (tipo IN ('MESA', 'ITENS', 'MESA_E_ITENS')),
    CONSTRAINT chk_status_reserva CHECK (status IN ('PENDENTE', 'CONFIRMADA', 'CANCELADA', 'NAO_COMPARECEU')),
    CONSTRAINT chk_valor_previsto CHECK (valor_total_previsto >= 0.00),
    CONSTRAINT chk_valor_pago_reserva CHECK (valor_pago >= 0.00)
);

CREATE INDEX idx_reservas_restaurante ON reservas(id_restaurante);
CREATE INDEX idx_reservas_mesa ON reservas(id_mesa);
CREATE INDEX idx_reservas_usuario ON reservas(id_usuario);
CREATE INDEX idx_reservas_data ON reservas(data_hora_reserva);
CREATE INDEX idx_reservas_status ON reservas(status);

-- =====================================================
-- TABELA: reservas_itens
-- =====================================================
CREATE TABLE reservas_itens (
    id_reserva_item SERIAL PRIMARY KEY,
    id_reserva INTEGER NOT NULL,
    id_item INTEGER NOT NULL,
    quantidade INTEGER NOT NULL,
    observacoes VARCHAR(255) NULL,
    valor_unitario DECIMAL(10,2) NOT NULL,
    valor_total DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (id_reserva) REFERENCES reservas(id_reserva) ON DELETE CASCADE,
    FOREIGN KEY (id_item) REFERENCES cardapio_itens(id_item) ON DELETE CASCADE,
    CONSTRAINT chk_quantidade_reserva CHECK (quantidade >= 1),
    CONSTRAINT chk_valor_unitario_reserva CHECK (valor_unitario > 0.00),
    CONSTRAINT chk_valor_total_reserva CHECK (valor_total >= 0.00)
);

CREATE INDEX idx_reservas_itens_reserva ON reservas_itens(id_reserva);
CREATE INDEX idx_reservas_itens_item ON reservas_itens(id_item);

-- =====================================================
-- TABELA: pedidos
-- =====================================================
CREATE TABLE pedidos (
    id_pedido SERIAL PRIMARY KEY,
    id_sessao INTEGER NOT NULL,
    id_usuario_cliente INTEGER NULL,
    id_usuario_garcom INTEGER NULL,
    status VARCHAR(20) NOT NULL,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP NULL DEFAULT NULL,
    FOREIGN KEY (id_sessao) REFERENCES sessoes(id_sessao) ON DELETE CASCADE,
    FOREIGN KEY (id_usuario_cliente) REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    FOREIGN KEY (id_usuario_garcom) REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    CONSTRAINT chk_status_pedido CHECK (status IN ('CRIADO', 'ENVIADO_COZINHA', 'EM_PREPARO', 'PRONTO', 'ENTREGUE', 'CANCELADO'))
);

CREATE INDEX idx_pedidos_sessao ON pedidos(id_sessao);
CREATE INDEX idx_pedidos_cliente ON pedidos(id_usuario_cliente);
CREATE INDEX idx_pedidos_garcom ON pedidos(id_usuario_garcom);
CREATE INDEX idx_pedidos_status ON pedidos(status);

-- =====================================================
-- TABELA: pedidos_itens
-- =====================================================
CREATE TABLE pedidos_itens (
    id_pedido_item SERIAL PRIMARY KEY,
    id_pedido INTEGER NOT NULL,
    id_item INTEGER NOT NULL,
    quantidade INTEGER NOT NULL,
    observacoes VARCHAR(255) NULL,
    valor_unitario DECIMAL(10,2) NOT NULL,
    valor_total DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (id_pedido) REFERENCES pedidos(id_pedido) ON DELETE CASCADE,
    FOREIGN KEY (id_item) REFERENCES cardapio_itens(id_item) ON DELETE CASCADE,
    CONSTRAINT chk_quantidade_pedido CHECK (quantidade >= 1),
    CONSTRAINT chk_valor_unitario_pedido CHECK (valor_unitario > 0.00),
    CONSTRAINT chk_valor_total_pedido CHECK (valor_total >= 0.00)
);

CREATE INDEX idx_pedidos_itens_pedido ON pedidos_itens(id_pedido);
CREATE INDEX idx_pedidos_itens_item ON pedidos_itens(id_item);

-- =====================================================
-- TABELA: pedidos_status_historico
-- =====================================================
CREATE TABLE pedidos_status_historico (
    id_status SERIAL PRIMARY KEY,
    id_pedido INTEGER NOT NULL,
    status_anterior VARCHAR(20) NOT NULL,
    status_novo VARCHAR(20) NOT NULL,
    data_hora TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    id_usuario_responsavel INTEGER NULL,
    FOREIGN KEY (id_pedido) REFERENCES pedidos(id_pedido) ON DELETE CASCADE,
    FOREIGN KEY (id_usuario_responsavel) REFERENCES usuarios(id_usuario) ON DELETE SET NULL
);

CREATE INDEX idx_pedido_historico_pedido ON pedidos_status_historico(id_pedido);
CREATE INDEX idx_pedido_historico_data ON pedidos_status_historico(data_hora);

-- =====================================================
-- TABELA: cozinha_filas
-- =====================================================
CREATE TABLE cozinha_filas (
    id_fila SERIAL PRIMARY KEY,
    id_pedido_item INTEGER NOT NULL,
    setor VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP NULL DEFAULT NULL,
    FOREIGN KEY (id_pedido_item) REFERENCES pedidos_itens(id_pedido_item) ON DELETE CASCADE,
    CONSTRAINT chk_setor CHECK (setor IN ('COZINHA', 'BAR')),
    CONSTRAINT chk_status_fila CHECK (status IN ('AGUARDANDO', 'EM_PREPARO', 'PRONTO'))
);

CREATE INDEX idx_cozinha_filas_item ON cozinha_filas(id_pedido_item);
CREATE INDEX idx_cozinha_filas_setor ON cozinha_filas(setor);
CREATE INDEX idx_cozinha_filas_status ON cozinha_filas(status);

-- =====================================================
-- TABELA: pagamentos
-- =====================================================
CREATE TABLE pagamentos (
    id_pagamento SERIAL PRIMARY KEY,
    id_sessao INTEGER NULL,
    id_reserva INTEGER NULL,
    origem VARCHAR(20) NOT NULL,
    valor_total DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) NOT NULL,
    metodo VARCHAR(20) NOT NULL,
    stripe_payment_intent_id VARCHAR(100) NULL UNIQUE,
    stripe_session_id VARCHAR(100) NULL,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP NULL DEFAULT NULL,
    FOREIGN KEY (id_sessao) REFERENCES sessoes(id_sessao) ON DELETE CASCADE,
    FOREIGN KEY (id_reserva) REFERENCES reservas(id_reserva) ON DELETE CASCADE,
    CONSTRAINT chk_origem_pagamento CHECK (origem IN ('RESERVA', 'CONSUMO')),
    CONSTRAINT chk_valor_pagamento CHECK (valor_total > 0.00),
    CONSTRAINT chk_status_pagamento CHECK (status IN ('PENDENTE', 'AUTORIZADO', 'CAPTURADO', 'CANCELADO', 'ESTORNADO')),
    CONSTRAINT chk_metodo_pagamento CHECK (metodo IN ('CARTAO', 'DINHEIRO', 'MISTO'))
);

CREATE INDEX idx_pagamentos_sessao ON pagamentos(id_sessao);
CREATE INDEX idx_pagamentos_reserva ON pagamentos(id_reserva);
CREATE INDEX idx_pagamentos_status ON pagamentos(status);
CREATE INDEX idx_pagamentos_stripe_intent ON pagamentos(stripe_payment_intent_id);

-- =====================================================
-- TABELA: pagamentos_divisoes
-- =====================================================
CREATE TABLE pagamentos_divisoes (
    id_divisao SERIAL PRIMARY KEY,
    id_pagamento INTEGER NOT NULL,
    id_usuario_pagador INTEGER NOT NULL,
    valor DECIMAL(10,2) NOT NULL,
    percentual DECIMAL(5,2) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_pagamento) REFERENCES pagamentos(id_pagamento) ON DELETE CASCADE,
    FOREIGN KEY (id_usuario_pagador) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    CONSTRAINT chk_valor_divisao CHECK (valor > 0.00),
    CONSTRAINT chk_percentual_divisao CHECK (percentual IS NULL OR (percentual BETWEEN 0.00 AND 100.00)),
    CONSTRAINT chk_status_divisao CHECK (status IN ('PENDENTE', 'PAGO', 'CANCELADO'))
);

CREATE INDEX idx_pagamentos_divisoes_pagamento ON pagamentos_divisoes(id_pagamento);
CREATE INDEX idx_pagamentos_divisoes_usuario ON pagamentos_divisoes(id_usuario_pagador);

-- =====================================================
-- TABELA: pagamentos_formas
-- =====================================================
CREATE TABLE pagamentos_formas (
    id_pagamento_forma SERIAL PRIMARY KEY,
    id_pagamento INTEGER NOT NULL,
    tipo VARCHAR(20) NOT NULL,
    valor DECIMAL(10,2) NOT NULL,
    stripe_charge_id VARCHAR(100) NULL,
    FOREIGN KEY (id_pagamento) REFERENCES pagamentos(id_pagamento) ON DELETE CASCADE,
    CONSTRAINT chk_tipo_forma CHECK (tipo IN ('CARTAO', 'DINHEIRO')),
    CONSTRAINT chk_valor_forma CHECK (valor > 0.00)
);

CREATE INDEX idx_pagamentos_formas_pagamento ON pagamentos_formas(id_pagamento);

-- =====================================================
-- TABELA: taxas_transacao
-- =====================================================
CREATE TABLE taxas_transacao (
    id_taxa SERIAL PRIMARY KEY,
    id_pagamento INTEGER NOT NULL,
    valor_api_gateway DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    valor_plataforma DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    percentual_plataforma DECIMAL(5,2) NOT NULL DEFAULT 1.00,
    FOREIGN KEY (id_pagamento) REFERENCES pagamentos(id_pagamento) ON DELETE CASCADE,
    CONSTRAINT chk_valor_gateway CHECK (valor_api_gateway >= 0.00),
    CONSTRAINT chk_valor_plataforma_taxa CHECK (valor_plataforma >= 0.00),
    CONSTRAINT chk_percentual_plataforma CHECK (percentual_plataforma BETWEEN 0.00 AND 5.00)
);

CREATE INDEX idx_taxas_pagamento ON taxas_transacao(id_pagamento);

-- =====================================================
-- TABELA: funcionarios_restaurante
-- =====================================================
CREATE TABLE funcionarios_restaurante (
    id_funcionario SERIAL PRIMARY KEY,
    id_usuario INTEGER NOT NULL,
    id_restaurante INTEGER NOT NULL,
    funcao VARCHAR(20) NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT true,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    FOREIGN KEY (id_restaurante) REFERENCES restaurantes(id_restaurante) ON DELETE CASCADE,
    CONSTRAINT chk_funcao CHECK (funcao IN ('GARCOM', 'GERENTE', 'COZINHA', 'BAR')),
    CONSTRAINT uk_usuario_restaurante UNIQUE (id_usuario, id_restaurante)
);

CREATE INDEX idx_funcionarios_usuario ON funcionarios_restaurante(id_usuario);
CREATE INDEX idx_funcionarios_restaurante ON funcionarios_restaurante(id_restaurante);
CREATE INDEX idx_funcionarios_funcao ON funcionarios_restaurante(funcao);

-- =====================================================
-- TRIGGERS PARA ATUALIZAÇÃO AUTOMÁTICA DE TIMESTAMPS
-- =====================================================

-- Função genérica para atualizar campo atualizado_em
CREATE OR REPLACE FUNCTION atualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger nas tabelas relevantes
CREATE TRIGGER trigger_usuarios_atualizado
BEFORE UPDATE ON usuarios
FOR EACH ROW
EXECUTE FUNCTION atualizar_timestamp();

CREATE TRIGGER trigger_restaurantes_atualizado
BEFORE UPDATE ON restaurantes
FOR EACH ROW
EXECUTE FUNCTION atualizar_timestamp();

CREATE TRIGGER trigger_pedidos_atualizado
BEFORE UPDATE ON pedidos
FOR EACH ROW
EXECUTE FUNCTION atualizar_timestamp();

CREATE TRIGGER trigger_cozinha_filas_atualizado
BEFORE UPDATE ON cozinha_filas
FOR EACH ROW
EXECUTE FUNCTION atualizar_timestamp();

CREATE TRIGGER trigger_pagamentos_atualizado
BEFORE UPDATE ON pagamentos
FOR EACH ROW
EXECUTE FUNCTION atualizar_timestamp();

-- =====================================================
-- COMENTÁRIOS NAS TABELAS E COLUNAS
-- =====================================================

COMMENT ON TABLE usuarios IS 'Armazena todos os usuários do sistema (consumidores e funcionários)';
COMMENT ON TABLE papeis IS 'Define os tipos de permissões disponíveis no sistema';
COMMENT ON TABLE restaurantes IS 'Cadastro de restaurantes parceiros';
COMMENT ON TABLE mesas IS 'Mesas físicas dos restaurantes';
COMMENT ON TABLE sessoes IS 'Sessões de consumo em restaurantes';
COMMENT ON TABLE cardapio_itens IS 'Itens do cardápio dos restaurantes';
COMMENT ON TABLE pedidos IS 'Pedidos realizados durante sessões';
COMMENT ON TABLE pagamentos IS 'Transações financeiras do sistema';
COMMENT ON TABLE reservas IS 'Reservas de mesas e/ou itens';

-- =====================================================
-- VIEWS ÚTEIS
-- =====================================================

-- View para visualizar usuários com seus papéis
CREATE OR REPLACE VIEW vw_usuarios_completo AS
SELECT 
    u.id_usuario,
    u.nome_completo,
    u.email,
    u.telefone,
    u.ativo,
    p.nome as papel,
    up.id_restaurante
FROM usuarios u
LEFT JOIN usuarios_papeis up ON u.id_usuario = up.id_usuario
LEFT JOIN papeis p ON up.id_papel = p.id_papel;

-- View para pedidos com valor total
CREATE OR REPLACE VIEW vw_pedidos_resumo AS
SELECT 
    p.id_pedido,
    p.id_sessao,
    p.status,
    p.criado_em,
    COUNT(pi.id_pedido_item) as total_itens,
    SUM(pi.valor_total) as valor_total_pedido
FROM pedidos p
LEFT JOIN pedidos_itens pi ON p.id_pedido = pi.id_pedido
GROUP BY p.id_pedido, p.id_sessao, p.status, p.criado_em;

-- View para sessões com valores totais
CREATE OR REPLACE VIEW vw_sessoes_resumo AS
SELECT 
    s.id_sessao,
    s.id_restaurante,
    r.nome_fantasia as restaurante_nome,
    s.id_mesa,
    m.identificador_mesa,
    s.status,
    s.inicio_efetivo,
    s.fim_efetivo,
    COUNT(DISTINCT p.id_pedido) as total_pedidos,
    SUM(pi.valor_total) as valor_total_consumo
FROM sessoes s
JOIN restaurantes r ON s.id_restaurante = r.id_restaurante
LEFT JOIN mesas m ON s.id_mesa = m.id_mesa
LEFT JOIN pedidos p ON s.id_sessao = p.id_sessao
LEFT JOIN pedidos_itens pi ON p.id_pedido = pi.id_pedido
GROUP BY s.id_sessao, s.id_restaurante, r.nome_fantasia, s.id_mesa, 
         m.identificador_mesa, s.status, s.inicio_efetivo, s.fim_efetivo;

-- =====================================================
-- FINALIZAÇÃO
-- =====================================================

-- Mensagem de sucesso
DO $$
BEGIN
    RAISE NOTICE 'Script executado com sucesso!';
    RAISE NOTICE 'Total de tabelas criadas: 30';
    RAISE NOTICE 'Sistema pronto para uso.';
END $$;