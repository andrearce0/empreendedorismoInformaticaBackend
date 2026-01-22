import type { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../services/dbService.js';
import { config } from '../config.js';
//const JWT_SECRET = process.env.JWT_SECRET || 'secret';

export class AuthController {

    /**
     * Register a new user with 'CONSUMIDOR' role automatically.
     */
    static async register(req: Request, res: Response, next: NextFunction) {
        // 1. Validação Básica de Entrada
        const { fullName, email, phone, password } = req.body;
        if (!fullName || !email || !password || !phone) {
            return res.status(400).json({ success: false, message: 'Todos os campos são obrigatórios.' });
        }

        // Precisamos de um cliente dedicado para fazer transação (Transaction)
        // Se seu dbService não tiver o método getClient, precisaremos criá-lo no próximo passo.
        const client = await db.getClient();

        try {
            await client.query('BEGIN'); // Inicia a transação

            // 2. Verifica se usuário já existe
            const existingUserResult = await client.query(
                'SELECT id_usuario FROM usuarios WHERE email = $1',
                [email]
            );

            if (existingUserResult.rows.length > 0) {
                await client.query('ROLLBACK'); // Cancela tudo se falhar
                return res.status(400).json({ success: false, message: 'Usuário já cadastrado.' });
            }

            // 3. Hash da senha
            const passwordHash = await bcrypt.hash(password, 10);

            // 4. Cria o Usuário
            const newUserResult = await client.query(
                `INSERT INTO usuarios (nome_completo, email, telefone, senha_hash) 
                 VALUES ($1, $2, $3, $4) 
                 RETURNING id_usuario as id, email, nome_completo`,
                [fullName, email, phone, passwordHash]
            );
            const user = newUserResult.rows[0];

            // 5. Atribui o Papel de 'CONSUMIDOR' automaticamente
            // Busca o ID do papel 'CONSUMIDOR' e insere na tabela de ligação
            const roleInsertQuery = `
                INSERT INTO usuarios_papeis (id_usuario, id_papel)
                SELECT $1, id_papel FROM papeis WHERE nome = 'CONSUMIDOR'
            `;
            await client.query(roleInsertQuery, [user.id]);

            await client.query('COMMIT'); // Confirma a transação (Salva tudo)

            res.status(201).json({
                success: true,
                message: 'Usuário registrado com sucesso.',
                data: user,
            });

        } catch (error) {
            await client.query('ROLLBACK'); // Desfaz tudo se der erro
            next(error);
        } finally {
            client.release(); // Libera o cliente volta pro pool
        }
    }

    /**
     * Login user and return JWT.
     */
    static async login(req: Request, res: Response, next: NextFunction) {
        try {
            const { email, password } = req.body;

            // Busca usuário e seus papéis (roles) em uma única query
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

            const user = userResult.rows[0];


            console.log('Segredo usado para ASSINAR:', config.jwtSecret);
            if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
                return res.status(401).json({ success: false, message: 'Credenciais inválidas.' });
            }

            // Gera o Token
            const token = jwt.sign(
                { id: user.id, email: user.email, roles: user.roles },
                config.jwtSecret, // <--- Use a variável centralizada
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
}