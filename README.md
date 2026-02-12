# 🍽️ Restaurant Management System (API)

Sistema de backend para gestão de restaurantes, pedidos de mesa via QR Code e sistema de exibição de cozinha (KDS).

## 🚀 Funcionalidades

- **Autenticação JWT:** Login para clientes (com e sem cadastro) e funcionários.
- **Gestão de Restaurante:** Cadastro de mesas, cardápio, ingredientes e fichas técnicas.
- **Pedidos em Tempo Real:** Clientes abrem mesas (sessões) via QR Code e fazem pedidos colaborativos.
- **KDS (Kitchen Display System):** Fila de pedidos separada por setores (Cozinha, Bar, etc.) com atualização de status.
- **Controle de Sessão:** Múltiplos clientes podem entrar na mesma mesa e pedir juntos.

## 📚 Documentação da API

Todas as rotas (exceto `/auth`) exigem o header:
`Authorization: Bearer <SEU_TOKEN>`

### 1. Autenticação (`/auth`)

| Método | Endpoint | Descrição |
| --- | --- | --- |
| `POST` | `/auth/register` | Cria uma nova conta de usuário. |
| `POST` | `/auth/login` | Login com email e senha. |
| `POST` | `/auth/anonymous` | Login anônimo (para clientes rápidos). |

**Exemplo Body (Register):**

```json
{
  "nome": "Cliente Teste",
  "email": "cliente@email.com",
  "senha": "123",
  "telefone": "11999999999"
}

```

### 2. Gerenciamento (`/manager`)

*Apenas para Donos e Gerentes.*

| Método | Endpoint | Descrição |
| --- | --- | --- |
| `POST` | `/manager/restaurant` | Cadastra um novo restaurante. |
| `POST` | `/manager/restaurant/:id/tables` | Adiciona mesas ao restaurante. |
| `POST` | `/manager/restaurant/:id/staff` | Contrata funcionários (Cozinha, Bar, Garçom). |
| `POST` | `/manager/restaurant/:id/menu` | Adiciona itens ao cardápio. |
| `POST` | `/manager/restaurant/:id/ingredients` | Cadastra ingredientes no estoque. |
| `POST` | `/manager/restaurant/:id/menu/:itemId/ingredients` | Vincula ingrediente ao prato (Ficha Técnica). |

**Exemplo Body (Menu):**

```json
{
  "nome": "X-Bacon",
  "preco": 35.90,
  "categoria": "Lanches",
  "descricao": "Pão, carne, queijo e bacon."
}

```

### 3. Sessão e Pedidos (`/api`)

*Para Clientes na mesa.*

#### **Abrir Mesa (QR Code)**

`POST /api/sessions/open`

* Cria uma nova sessão ou entra em uma existente.

```json
{ "idMesa": 1 }

```

#### **Fazer Pedido**

`POST /api/orders`

* Envia itens para a produção.

```json
{
  "sessionId": 50,
  "items": [
    { "idItem": 10, "quantity": 1, "observation": "Ao ponto" },
    { "idItem": 11, "quantity": 2, "observation": "Com gelo" }
  ]
}

```

#### **Ver Pedidos da Mesa**

`GET /api/session/:sessionId/orders`

* Lista o histórico de pedidos daquela sessão.

### 4. Cozinha e KDS (`/kitchen`)

*Para Funcionários (Cozinha e Bar).*

#### **Ver Fila de Produção**

`GET /api/kitchen/queue`

* Lista todos os pedidos pendentes.

**Filtros (Query Params):**

* `?setor=Bebidas` (Para a tela do Bar)
* `?setor=Lanches` (Para a tela da Cozinha)

#### **Atualizar Status do Item**

`PATCH /api/kitchen/queue/:idFila/status`

* Atualiza o andamento de um item específico.

```json
{ "status": "EM_PREPARO" }

```

Status permitidos: `PENDENTE`, `EM_PREPARO`, `PRONTO`, `ENTREGUE`.

---

## 📂 Estrutura do Projeto

```
src/
├── config/         # Conexão com o Banco de Dados
├── controllers/    # Lógica de negócio (Auth, Manager, Order, Kitchen)
├── middlewares/    # Autenticação e validações
├── routes/         # Definição das rotas da API
└── app.js          # Ponto de entrada
