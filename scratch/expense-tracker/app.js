import 'dotenv/config';
import { createDolphinServer } from 'dolphin-server-modules/server';
import { createMongooseAdapter } from 'dolphin-server-modules/adapters/mongoose';
import { connectDB } from './config/database.js';

// Import Routes
import authRoutes from './routes/authRoutes.js';
import expenseRoutes from './routes/expenseRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';

const startServer = async () => {
  // 1. Initialize Database
  await connectDB();

  // 2. Initialize Server
  const app = createDolphinServer({
    port: process.env.PORT || 3000,
    adapter: createMongooseAdapter(),
    cors: true,
    logging: true
  });

  // 3. Register Routes
  app.router((router) => {
    authRoutes(router);
    expenseRoutes(router);
    categoryRoutes(router);
  });

  // 4. Default Health Check
  app.get('/', (ctx) => ({
    status: 'online',
    service: 'Smart Expense Tracker API',
    timestamp: new Date().toISOString()
  }));

  // 5. Start
  app.start(() => {
    console.log(`Dolphin Server running on port ${process.env.PORT || 3000}`);
    console.log('Dolphin is swimming!');
  });
};

startServer();