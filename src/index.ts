import 'dotenv/config';
import app from './app.js';

const PORT = process.env.PORT || 3000;

/**
 * Start the Express server.
 */
app.listen(PORT, () => {
    console.log(`
  🚀 Server is running!
  📡 URL: http://localhost:${PORT}
  🛠️  Mode: ${process.env.NODE_ENV || 'development'}
  `);
});
