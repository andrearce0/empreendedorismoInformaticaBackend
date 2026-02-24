import { query } from './db.js';

async function checkData() {
    try {
        console.log('--- Verificando Dados na Tabela Restaurantes ---');
        const res = await query('SELECT * FROM restaurantes');

        if (res.rows.length === 0) {
            console.log('⚠️ A tabela "restaurantes" está VAZIA.');
        } else {
            console.log(`✅ Foram encontrados ${res.rows.length} restaurantes:`);
            res.rows.forEach(row => {
                console.log(` - [ID: ${row.id}] Nome: ${row.nome} | Lat: ${row.latitude} | Long: ${row.longitude}`);
            });
        }
    } catch (err) {
        console.error('❌ Erro ao buscar dados:', err.message);
    } finally {
        process.exit();
    }
}

checkData();
