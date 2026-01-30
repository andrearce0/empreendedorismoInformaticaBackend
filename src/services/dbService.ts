import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Configuração do Pool
if (!process.env.DATABASE_URL) {
    console.error('\x1b[31m%s\x1b[0m', '❌ ERROR: DATABASE_URL is not defined in .env file');
}

// Dica: Para o Supabase em produção, talvez você precise adicionar "ssl: true" aqui futuramente.
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || '',
});

// Logging connection events
pool.on('connect', () => {
    // Comentado para não poluir o terminal em cada query, mas útil para debug
    // console.log('Database connected successfully');
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

export default {
    /**
     * Executa uma query simples (pega conexão, executa, libera).
     * Use para leituras ou escritas únicas.
     */
    query: (text: string, params?: any[]) => pool.query(text, params),

    /**
     * Retorna um cliente dedicado do pool.
     * OBRIGATÓRIO: Você deve executar client.release() quando terminar.
     * Use para Transações (BEGIN/COMMIT).
     */
    getClient: () => pool.connect(),

    // Exportamos o pool caso precise acessar propriedades diretas dele
    pool,
};