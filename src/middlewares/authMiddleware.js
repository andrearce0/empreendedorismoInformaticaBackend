import jwt from 'jsonwebtoken';

export const authenticate = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Pega o token depois de "Bearer"

    if (!token) {
        return res.status(401).json({ error: 'Acesso negado. Token não fornecido.' });
    }

    try {
        const secret = process.env.JWT_SECRET || 'segredo_padrao_dev';

        // Verifica e decodifica o token
        const decoded = jwt.verify(token, secret);

        // Anexa os dados do usuário na requisição para usar nos controllers
        req.user = decoded;

        next(); // Pode passar
    } catch (error) {
        return res.status(403).json({ error: 'Token inválido ou expirado.' });
    }
};

/**
 * (Opcional) Middleware para checar permissões específicas
 * Ex: authorize(['GERENTE', 'ADMIN'])
 */
export const authorize = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !req.user.roles) {
            return res.status(403).json({ error: 'Sem permissão.' });
        }

        const hasRole = req.user.roles.some(role => allowedRoles.includes(role));
        if (!hasRole) {
            return res.status(403).json({ error: 'Acesso proibido para seu nível de usuário.' });
        }
        next();
    };
};