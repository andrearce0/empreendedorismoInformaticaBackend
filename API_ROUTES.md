# Documentação das Rotas da API

Esta documentação detalha os endpoints disponíveis na API do backend.

## Sumário
- [Status](#status)
- [Autenticação](#autenticação-apiauth)
- [Restaurantes](#restaurantes-apirestaurants)
- [Usuários](#usuários-apiusers)
- [Gerenciamento (Manager)](#gerenciamento-apimanager)
- [Alérgenos](#alérgenos-apiallergens)

---

## Status
Verificação de saúde da API.

| Método | Rota | Descrição |
| :--- | :--- | :--- |
| `GET` | `/api/status` | Retorna o status atual da API, timestamp e versão. |

---

## Autenticação (`/api/auth`)
Endpoints para registro e login de usuários.

| Método | Rota | Descrição | Corpo da Requisição |
| :--- | :--- | :--- | :--- |
| `POST` | `/register` | Registra um novo usuário (CONSUMIDOR). | `fullName`, `email`, `phone`, `password` |
| `POST` | `/login` | Realiza login e retorna um JWT. | `email`, `password` |

---

## Restaurantes (`/api/restaurants`)
Endponts públicos para visualização de restaurantes.

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
Endpoints exclusivos para gerentes e funcionários (requerem autenticação).

| Método | Rota | Descrição | Roles Permitidas |
| :--- | :--- | :--- | :--- |
| `POST` | `/restaurant` | Cria um restaurante e vincula o usuário como GERENTE. | Qualquer usuário logado |
| `GET` | `/restaurants` | Lista os restaurantes onde o usuário trabalha. | Qualquer usuário logado |
| `PATCH` | `/:restaurantId/settings` | Atualiza configurações do restaurante. | GERENTE |
| `POST` | `/:restaurantId/staff` | Adiciona um funcionário à equipe. | GERENTE |
| `GET` | `/:restaurantId/staff` | Lista a equipe do restaurante. | GERENTE |
| `POST` | `/:restaurantId/menu` | Cria um novo item no cardápio. | GERENTE |
| `GET` | `/:restaurantId/menu` | Lista os itens do cardápio do restaurante. | GERENTE |
| `POST` | `/:restaurantId/tables` | Cria uma nova mesa no restaurante. | GERENTE |
| `GET` | `/:restaurantId/analytics` | Obtém dados analíticos (ex: itens mais vendidos). | GERENTE |

---

## Alérgenos (`/api/allergens`)
Endpoints de consulta de alérgenos.

| Método | Rota | Descrição |
| :--- | :--- | :--- |
| `GET` | `/` | Lista todos os alérgenos cadastrados. |
