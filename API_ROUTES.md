# Documentação das Rotas da API

Esta documentação detalha os endpoints disponíveis na API do backend do sistema de gestão de restaurantes.

## Sumário
- [Status](#status)
- [Autenticação](#autenticação-apiauth)
- [Restaurantes](#restaurantes-apirestaurants)
- [Usuários](#usuários-apiusers)
- [Gerenciamento (Manager)](#gerenciamento-apimanager)
- [Sessões (Mesa)](#sessões-apisessions)
- [Pedidos](#pedidos-apiorders)
- [Cozinha (KDS)](#cozinha-apikitchen)
- [Pagamentos](#pagamentos-apipayments)
- [Alérgenos](#alérgenos-apiallergens)

---

## Status
Verificação de saúde da API.

| Método | Rota | Descrição |
| :--- | :--- | :--- |
| `GET` | `/api/status` | Retorna o status atual da API, timestamp e versão. |

---

## Autenticação (`/api/auth`)
Endpoints para registro, login e acesso de convidados.

| Método | Rota | Descrição | Corpo da Requisição (Body) |
| :--- | :--- | :--- | :--- |
| `POST` | `/register` | Registra um novo usuário (CONSUMIDOR). | `fullName`, `email`, `phone`, `password` |
| `POST` | `/login` | Realiza login e retorna um JWT. | `email`, `password` |
| `POST` | `/anonymous` | **(Novo)** Gera um acesso temporário para convidados (Guest). Retorna token. | *Vazio* |

---

## Restaurantes (`/api/restaurants`)
Endpoints públicos para visualização de restaurantes.

| Método | Rota | Descrição |
| :--- | :--- | :--- |
| `GET` | `/` | Lista todos os restaurantes ativos. |
| `GET` | `/:id` | Obtém detalhes de um restaurante específico (incluindo mesas e cardápio). |
| `POST` | `/` | Registra um novo restaurante (uso administrativo). |

---

## Usuários (`/api/users`)
Endpoints relacionados aos usuários do sistema.

| Método | Rota | Descrição |
| :--- | :--- | :--- |
| `GET` | `/` | Lista todos os usuários ativos. |
| `GET` | `/me` | Obtém o perfil do usuário logado (requer autenticação). |
| `GET` | `/:id` | Obtém um usuário específico pelo ID. |

---

## Gerenciamento (`/api/manager`)
Endpoints exclusivos para gerentes (requer autenticação e permissão de GERENTE).

| Método | Rota | Descrição | Corpo/Params |
| :--- | :--- | :--- | :--- |
| `POST` | `/restaurant` | Cria um restaurante e vincula o usuário como GERENTE. | `tradeName`, `cnpj`, etc. |
| `GET` | `/restaurants` | Lista os restaurantes onde o usuário trabalha. | - |
| `PATCH` | `/:restaurantId/settings` | Atualiza configurações do restaurante. | Configs diversas |
| `POST` | `/:restaurantId/staff` | Adiciona um funcionário à equipe. | `email`, `role` |
| `GET` | `/:restaurantId/staff` | Lista a equipe do restaurante. | - |
| `POST` | `/:restaurantId/menu` | Cria um novo item no cardápio. | `nome`, `preco`, `categoria` |
| `GET` | `/:restaurantId/menu` | Lista os itens do cardápio. | - |
| `POST` | `/:restaurantId/tables` | Cria uma nova mesa. | `identifier`, `capacity` |
| **Ingredientes** | | | |
| `POST` | `/:restaurantId/ingredients` | **(Novo)** Cria um insumo/ingrediente no estoque. | `nome`, `preco`, `descricao` |
| `GET` | `/:restaurantId/ingredients` | **(Novo)** Lista todos os ingredientes cadastrados. | - |
| `POST` | `/:restaurantId/menu/:itemId/ingredients` | **(Novo)** Vincula um ingrediente a um item do cardápio. | `ingredientId`, `quantidade` |
| `GET` | `/:restaurantId/menu/:itemId/ingredients` | **(Novo)** Vê os ingredientes de um item (Ficha Técnica). | - |

---

## Sessões (`/api/sessions`)
Endpoints para controle de abertura de mesas. Requer Token de Usuário Logado ou Convidado (Anonymous).

| Método | Rota | Descrição | Corpo da Requisição |
| :--- | :--- | :--- | :--- |
| `POST` | `/open` | Abre uma mesa (QR Code) ou entra em uma existente. | `idMesa` |

---

## Pedidos (`/api/orders`)
Endpoints para realização de pedidos pelos clientes.

| Método | Rota | Descrição | Corpo da Requisição |
| :--- | :--- | :--- | :--- |
| `POST` | `/` | Cria um pedido vinculado à sessão e despacha tickets para cozinha/bar. | `idSessao`, `itens: [{ idProduto, quantidade, observacao }]` |

---

## Cozinha (`/api/kitchen`)
Endpoints para o KDS (Kitchen Display System). Requer permissão de Staff (Cozinha/Gerente/Garçom).

| Método | Rota | Descrição | Parâmetros/Body |
| :--- | :--- | :--- | :--- |
| `GET` | `/:restaurantId/queue` | Lista a fila de pedidos (Aguardando/Em Preparo). | Query: `?setor=COZINHA` ou `?setor=BAR` |
| `PATCH` | `/queue/:idFila` | Atualiza o status de um item (Avança etapa). | Body: `{ "status": "PRONTO" }` |

---

## Pagamentos (`/api/payments`)
Endpoints para fechamento de conta e transações financeiras.

| Método | Rota | Descrição | Corpo da Requisição |
| :--- | :--- | :--- | :--- |
| `GET` | `/session/:sessionId` | Obtém o extrato/conta da sessão (parcial e total). | - |
| `POST` | `/` | Registra pagamento. Se o valor total for atingido, fecha a mesa automaticamente. | `idSessao`, `valor`, `metodo` |

---

## Alérgenos (`/api/allergens`)
Endpoints de consulta de alérgenos.

| Método | Rota | Descrição |
| :--- | :--- | :--- |
| `GET` | `/` | Lista todos os alérgenos cadastrados. |