import { createDolphinServer } from 'dolphin-server-modules/server';
import { createDolphinAuthController } from 'dolphin-server-modules/auth-controller';
import { connectDB } from './adapters/connection.js';
import { db } from './adapters/db.js';
import { createCrudRouter } from 'dolphin-server-modules/crud';
import { Product } from './models/Product.js';

const app = createDolphinServer();

// Global Error Handler — server crash बाट बचाउँछ
app.use(async (ctx, next) => {
  try { if (next) await next(); }
  catch (error) {
    console.error('🔥 ERROR:', error.message);
    ctx.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// DB connect
connectDB(process.env.MONGO_URI || 'mongodb://localhost:27017/dolphin_db');

// Auth
const auth = createDolphinAuthController(db, {
  jwtSecret: process.env.JWT_SECRET || 'change_in_production',
});

app.post('/api/auth/register', auth.register);
app.post('/api/auth/login',    auth.login);
app.post('/api/auth/refresh',  auth.refresh);
app.post('/api/auth/logout',   auth.middleware(), auth.logout);

app.get('/health', (ctx) => ({ status: 'ok', ts: new Date().toISOString() }));

const PORT = parseInt(process.env.PORT || '3000');
app.use('/api/products', createCrudRouter(db, 'Product', { softDelete: true }));

app.listen(PORT, () => console.log(`🐬 Dolphin Server swimming on port ${PORT}`));
