import express from 'express';
import cors from 'cors';

// Importação das rotas
import authRoutes from './routes/authRoutes.js';
import restaurantRoutes from './routes/restaurantRoutes.js';
import sessionRoutes from './routes/sessionRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import managerRoutes from './routes/managerRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import kitchenRoutes from './routes/kitchenRoutes.js'
import { PaymentController } from './controllers/paymentController.js';
import allergenRoutes from './routes/allergenRoutes.js';
import restaurantRoutes from './routes/restaurantRoutes.js';

const app = express();

// --- Middlewares Globais ---
app.use(cors());

// OBSERVAÇÃO IMPORTANTE SOBRE WEBHOOKS:
// O Webhook do Stripe precisa ser lido ANTES do express.json() transformar tudo em objeto.
// No paymentRoutes.js, já configuramos o 'express.raw()' especificamente para aquela rota.
// Então podemos deixar o express.json() global aqui sem medo.
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// --- Definição das Rotas (Prefixos) ---

// Alérgenos -> /api/alergenos
app.use('/api/alergenos', allergenRoutes);

// Restaurantes -> /api/restaurants
app.use('/api/restaurants', restaurantRoutes);

// Autenticação -> /api/auth/login, /api/auth/register
app.use('/api/auth', authRoutes);

// Restaurantes -> /api/restaurants
app.use('/api', restaurantRoutes);

app.use('/api', orderRoutes);

// Sessões -> /api/session...
app.use('/api/session', sessionRoutes);

// Checkout Principal (Ajustado para o que o Front espera)
app.post('/api/create-checkout-session', PaymentController.createCheckoutSession);

//manager
app.use('/api/manager', managerRoutes);

//cozinha
app.use('/api/kitchen', kitchenRoutes);

// Pagamentos -> /api/payments/checkout
app.use('/api/payments', paymentRoutes);

export default app;