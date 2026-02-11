import * as db from '../config/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export class AuthController {

    /**
     * Registra um novo usuário (Consumidor)
     */
    static async register(req, res) {
        const client = await db.getClient();
        try {
            const { fullName, email, phone, password } = req.body;

            // Validação básica
            if (!email || !password || !fullName) {
                return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
            }

            await client.query('BEGIN'); // Inicia transação

            // 1. Verifica se já existe
            const userCheck = await client.query('SELECT id_usuario FROM usuarios WHERE email = $1', [email]);
            if (userCheck.rows.length > 0) {
                throw new Error('E-mail já cadastrado.');
            }

            // 2. Criptografa a senha
            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash(password, salt);

            // 3. Insere o Usuário
            const userResult = await client.query(
                `INSERT INTO usuarios (nome_completo, email, telefone, senha_hash) 
                 VALUES ($1, $2, $3, $4) 
                 RETURNING id_usuario, nome_completo, email`,
                [fullName, email, phone, passwordHash]
            );
            const newUser = userResult.rows[0];

            // 4. Atribui papel de 'CONSUMIDOR' (Busca o ID do papel antes)
            // Assumindo que você já rodou o seed do banco e o papel CONSUMIDOR existe
            const roleResult = await client.query("SELECT id_papel FROM papeis WHERE nome = 'CONSUMIDOR'");

            if (roleResult.rows.length > 0) {
                await client.query(
                    `INSERT INTO usuarios_papeis (id_usuario, id_papel) VALUES ($1, $2)`,
                    [newUser.id_usuario, roleResult.rows[0].id_papel]
                );
            }

            await client.query('COMMIT'); // Salva tudo

            res.status(201).json({
                success: true,
                message: 'Usuário registrado com sucesso!',
                user: newUser
            });

        } catch (error) {
            await client.query('ROLLBACK'); // Desfaz se der erro
            console.error('Erro no registro:', error);
            res.status(400).json({ success: false, error: error.message });
        } finally {
            client.release();
        }
    }

    /**
     * Realiza Login e retorna Token JWT
     */
    static async login(req, res) {
        try {
            const { email, password } = req.body;

            // 1. Busca usuário pelo email
            const result = await db.query('SELECT * FROM usuarios WHERE email = $1', [email]);

            if (result.rows.length === 0) {
                return res.status(401).json({ error: 'Credenciais inválidas.' });
            }

            const user = result.rows[0];

            // 2. Compara a senha enviada com o Hash do banco
            const validPassword = await bcrypt.compare(password, user.senha_hash);
            if (!validPassword) {
                return res.status(401).json({ error: 'Credenciais inválidas.' });
            }

            // 3. Busca os papéis (Roles) do usuário para por no token
            const rolesResult = await db.query(
                `SELECT p.nome 
                 FROM papeis p 
                 JOIN usuarios_papeis up ON p.id_papel = up.id_papel 
                 WHERE up.id_usuario = $1`,
                [user.id_usuario]
            );
            const roles = rolesResult.rows.map(r => r.nome);

            // 4. Gera o Token JWT
            const token = jwt.sign(
                {
                    id: user.id_usuario,
                    email: user.email,
                    roles: roles
                },
                process.env.JWT_SECRET || 'segredo_padrao_dev', // Coloque uma string forte no .env
                { expiresIn: '1d' } // Expira em 1 dia
            );

            res.json({
                success: true,
                message: 'Login realizado com sucesso.',
                token,
                user: {
                    id: user.id_usuario,
                    name: user.nome_completo,
                    email: user.email,
                    roles
                }
            });

        } catch (error) {
            console.error('Erro no login:', error);
            res.status(500).json({ error: 'Erro interno do servidor.' });
        }
    }
}