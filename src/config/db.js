import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Verifica se estamos em produção
const isProduction = process.env.NODE_ENV === 'production';

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
    connectionString,
    ssl: {
        rejectUnauthorized: false
    }
});

// Teste de conexão (opcional, ajuda a debugar)
pool.connect((err, client, release) => {
    if (err) {
        console.error('❌ Erro de conexão com o Banco:', err.message);
    } else {
        console.log('✅ Banco de Dados conectado!');
        release();
    }
});

export const query = (text, params) => pool.query(text, params);
export const getClient = () => pool.connect();