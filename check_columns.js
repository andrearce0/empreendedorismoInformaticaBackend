import { query } from './db.js';

async function checkColumns() {
    try {
        console.log('--- Verificando Colunas da Tabela Restaurantes ---');
        const res = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'restaurantes'
        `);

        console.log('✅ Colunas encontradas:');
        res.rows.forEach(row => console.log(` - ${row.column_name}`));

    } catch (err) {
        console.error('❌ Erro ao listar colunas:', err.message);
    } finally {
        process.exit();
    }
}

checkColumns();
