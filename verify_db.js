const db = require('./db');

async function verifyPayment() {
    try {
        const res = await db.query('SELECT * FROM pagamentos ORDER BY criado_em DESC LIMIT 1');
        if (res.rows.length > 0) {
            console.log('Last payment record found:');
            console.table(res.rows);
        } else {
            console.log('No payment records found.');
        }
        process.exit(0);
    } catch (err) {
        console.error('Error verifying payment:', err);
        process.exit(1);
    }
}

verifyPayment();
