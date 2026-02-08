const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false, // For Supabase/AWS managed databases
    },
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool,
};
