const { ensureTestData } = require('./testDataHelper');
const db = require('./db');

async function test() {
    try {
        console.log('Testing Database Connection...');
        const result = await db.query('SELECT NOW()');
        console.log('Connected! Time:', result.rows[0].now);

        console.log('Testing Data Helper...');
        const { restaurantId, sessionId } = await ensureTestData();
        console.log(`Success! Restaurant ID: ${restaurantId}, Session ID: ${sessionId}`);

        process.exit(0);
    } catch (err) {
        console.error('Test Failed:', err);
        process.exit(1);
    }
}

test();
