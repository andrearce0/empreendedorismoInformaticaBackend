import type { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../services/dbService.js';
import { config } from '../config.js';

export class AuthController {

    /**
     * Registrar um novo usuario com o papel 'CONSUMIDOR' automaticamente.
     */
    static async register(req: Request, res: Response, next: NextFunction) {

        const { fullName, email, phone, password } = req.body;
        if (!fullName || !email || !password || !phone) return res.status(400).json({ success: false, message: 'Todos os campos são obrigatórios.' });

        const client = await db.getClient();
        try {
            await client.query('BEGIN');
            const existingUserResult = await client.query('SELECT id_usuario FROM usuarios WHERE email = $1', [email]);
            if (existingUserResult.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ success: false, message: 'Usuário já cadastrado.' });
            }
            const passwordHash = await bcrypt.hash(password, 10);
            const newUserResult = await client.query(
                `INSERT INTO usuarios (nome_completo, email, telefone, senha_hash) VALUES ($1, $2, $3, $4) RETURNING id_usuario as id, email, nome_completo`,
                [fullName, email, phone, passwordHash]
            );
            const user = newUserResult.rows[0];
            await client.query(`INSERT INTO usuarios_papeis (id_usuario, id_papel) SELECT $1, id_papel FROM papeis WHERE nome = 'CONSUMIDOR'`, [user.id]);
            await client.query('COMMIT');
            res.status(201).json({ success: true, message: 'Usuário registrado com sucesso.', data: user });
        } catch (error) {
            await client.query('ROLLBACK');
            next(error);
        } finally {
            client.release();
        }
    }

    /**
     Realiza login do usuario
    */
    static async login(req: Request, res: Response, next: NextFunction) {
        try {
            const { email, password } = req.body;

            //Busca o usuario e seus papeis
            const userResult = await db.query(
                `SELECT u.id_usuario as id, u.email, u.senha_hash as "passwordHash", u.nome_completo as "fullName",
                        COALESCE(
                            json_agg(p.nome) FILTER (WHERE p.nome IS NOT NULL),
                            '[]'
                        ) as roles
                 FROM usuarios u
                 LEFT JOIN usuarios_papeis up ON u.id_usuario = up.id_usuario
                 LEFT JOIN papeis p ON up.id_papel = p.id_papel
                 WHERE u.email = $1
                 GROUP BY u.id_usuario`,
                [email]
            );

            if (userResult.rows.length === 0) {
                return res.status(401).json({ success: false, message: 'Credenciais inválidas.' });
            }

            const user = userResult.rows[0];

            //Valida a senha
            const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
            if (!isPasswordValid) {
                return res.status(401).json({ success: false, message: 'Credenciais inválidas.' });
            }

            //Verifica se o usuario e gerente de algum restaurante
            const checkGerente = await db.query(
                `SELECT 1 FROM funcionarios_restaurante 
                 WHERE id_usuario = $1 AND funcao = 'GERENTE' 
                 LIMIT 1`,
                [user.id]
            );

            //Se encontrou algum registro, adiciona 'GERENTE' na lista de roles do token
            if (checkGerente.rows.length > 0) {
                if (!user.roles.includes('GERENTE')) {
                    user.roles.push('GERENTE');
                }
            }

            //Gera o Token
            const token = jwt.sign(
                { id: user.id, email: user.email, roles: user.roles },
                config.jwtSecret,
                { expiresIn: '1d' }
            );

            res.json({
                success: true,
                token,
                data: {
                    id: user.id,
                    fullName: user.fullName,
                    email: user.email,
                    roles: user.roles,
                },
            });
        } catch (error) {
            next(error);
        }
    }

    //Permite pedidos sem login
    static async loginAnonymous(req: Request, res: Response, next: NextFunction) {
        const client = await db.getClient();
        try {
            await client.query('BEGIN');

            const { fullName } = req.body;

            // 1. Gerar dados fictícios únicos
            const timestamp = Date.now();
            const fakeEmail = `guest_${timestamp}@temp.com`;
            const fakePhone = `999${timestamp.toString().slice(-8)}`; // Ex: 99912345678
            const fakePass = await bcrypt.hash(`guest_${timestamp}`, 10); // Senha aleatória

            // 2. Criar o usuário "Fantasma" no banco
            // (Necessário pois a tabela sessoes exige id_usuario_criador)
            const userResult = await client.query(
                `INSERT INTO usuarios (nome_completo, email, telefone, senha_hash, ativo)
                 VALUES ($1, $2, $3, $4, true)
                 RETURNING id_usuario, nome_completo, email`,
                [fullName || 'Cliente Convidado', fakeEmail, fakePhone, fakePass]
            );

            const user = userResult.rows[0];

            // 3. Atribuir papel de CONSUMIDOR
            // Primeiro, precisamos descobrir o ID do papel CONSUMIDOR
            const roleResult = await client.query(`SELECT id_papel FROM papeis WHERE nome = 'CONSUMIDOR'`);

            if (roleResult.rows.length > 0) {
                await client.query(
                    `INSERT INTO usuarios_papeis (id_usuario, id_papel) VALUES ($1, $2)`,
                    [user.id_usuario, roleResult.rows[0].id_papel]
                );
            }

            await client.query('COMMIT');

            // 4. Gerar o Token (O front-end vai guardar isso sem o usuário perceber)
            const token = jwt.sign(
                { id: user.id_usuario, email: user.email, roles: ['CONSUMIDOR'] },
                process.env.JWT_SECRET || 'seusecretoparaassinaturatoken',
                { expiresIn: '1d' }
            );

            res.status(201).json({
                success: true,
                message: 'Acesso de convidado gerado.',
                token,
                user: {
                    id: user.id_usuario,
                    nome: user.nome_completo,
                    guest: true
                }
            });

        } catch (error) {
            await client.query('ROLLBACK');
            next(error);
        } finally {
            client.release();
        }
    }
}