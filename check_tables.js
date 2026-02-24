import { query } from './db.js';

async function checkTables() {
    try {
        console.log('--- Verificando Tabelas no Banco de Dados ---');
        const res = await query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);

        if (res.rows.length === 0) {
            console.log('⚠️ O banco está conectado, mas NÃO possui tabelas no esquema public.');
        } else {
            console.log('✅ Tabelas encontradas:');
            res.rows.forEach(row => console.log(` - ${row.table_name}`));
        }
    } catch (err) {
        console.error('❌ Erro ao listar tabelas:', err.message);
    } finally {
        process.exit();
    }
}

checkTables();
