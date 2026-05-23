import { createDolphinServer } from 'dolphin-server-modules/server';
import { createMongooseAdapter } from 'dolphin-server-modules/adapters/mongoose';
import { createDolphinAuthController } from 'dolphin-server-modules/auth-controller';

import schoolRoute from './routes/school/schoolRoute.js';

const app = createDolphinServer();

// DB Connection & Adapter
const dbAdapter = createMongooseAdapter(process.env.MONGO_URI || 'mongodb://localhost:27017/dolphin_db');

// Auth Setup
const auth = createDolphinAuthController({
    adapter: dbAdapter,
    jwtSecret: process.env.JWT_SECRET || 'dolphin_secret'
});

app.post('/api/auth/register', auth.register);
app.post('/api/auth/login', auth.login);
app.use('/api/schools', schoolRoute);

app.listen(3000, () => console.log('🐬 Dolphin Production Server is swimming on port 3000'));
