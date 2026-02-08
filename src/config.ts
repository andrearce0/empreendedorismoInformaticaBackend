import dotenv from 'dotenv';

// Carrega as variáveis de ambiente imediatamente
dotenv.config();

export const config = {
    jwtSecret: process.env.JWT_SECRET || 'fallback_secret_muito_inseguro_mude_isso',
    port: process.env.PORT || 3000,
    stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
    stripeAccountId: process.env.STRIPE_ACCOUNT_ID || ''
};