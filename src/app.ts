import express from 'express';
import type { Application } from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler.js';
import { logger } from './middleware/logger.js';

import restaurantRoutes from './routes/restaurantRoutes.js';
import userRoutes from './routes/userRoutes.js';
import authRoutes from './routes/authRoutes.js';
import managerRoutes from './routes/managerRoutes.js';
import allergenRoutes from './routes/allergenRoutes.js';

const app: Application = express();

/**
 * Standard Middlewares
 */
app.use(cors());
app.use(express.json());
app.use(logger);

/**
 * Health Check Route
 */
app.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

/**
 * API Routes
 */
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/manager', managerRoutes);
app.use('/api/allergens', allergenRoutes);

/**
 * Centralized Error Handling
 * (Must be the last middleware)
 */
app.use(errorHandler);

export default app;
