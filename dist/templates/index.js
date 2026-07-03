export const TEMPLATES = {
    app: `import { createDolphinServer } from 'dolphin-server-modules/server';
import { createDolphinAuthController } from 'dolphin-server-modules/auth-controller';
import { connectDB } from './adapters/connection.js';
import { db } from './adapters/db.js';

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
app.listen(PORT, () => console.log(\`🐬 Dolphin Server swimming on port \${PORT}\`));
`,
    adaptersConnection: `import mongoose from 'mongoose';

export const connectDB = async (uri = process.env.MONGO_URI || 'mongodb://localhost:27017/dolphin_db') => {
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log('✅ MongoDB Connected:', mongoose.connection.host);
  } catch (e) {
    console.error('❌ MongoDB Error:', e.message);
    process.exit(1);
  }
};

mongoose.connection.on('disconnected', () => console.warn('⚠️  MongoDB disconnected'));
mongoose.connection.on('error', (err) => console.error('❌ MongoDB:', err.message));
`,
    adaptersDbDecoupled: `import { createMongooseAdapter } from 'dolphin-server-modules/adapters/mongoose';
import { User, RefreshToken } from '../models/User.js';

export const db = createMongooseAdapter({
  User,
  RefreshToken,
  models: {
    // यहाँ अरू CRUD models थप्नुहोस् (User र RefreshToken थप्नु हुन्न — माथि नै छ)
    // उदाहरण: Product, Order, Category ...
  },
  leanByDefault: true,
  softDelete: false
});
`,
    mongoose: `import mongoose from 'mongoose';
import { createMongooseAdapter } from 'dolphin-server-modules/adapters/mongoose';

// Safe default models (error atdaina even if real User model not created yet)
const dummySchema = new mongoose.Schema({ email: String, token: String }, { versionKey: false });
const User = mongoose.models.User || mongoose.model('User', dummySchema);
const RefreshToken = mongoose.models.RefreshToken || mongoose.model('RefreshToken', dummySchema);

export const connectDB = async (uri = process.env.MONGO_URI) => {
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log('✅ MongoDB Connected:', mongoose.connection.host);
  } catch (e) {
    console.error('❌ MongoDB Error:', e.message);
    process.exit(1);
  }
};

mongoose.connection.on('disconnected', () => console.warn('⚠️  MongoDB disconnected'));
mongoose.connection.on('error', (err) => console.error('❌ MongoDB:', err.message));

// Ready-to-use Dolphin adapter (legacy single file)
export const db = createMongooseAdapter({
  User,
  RefreshToken,
  models: {
    // Product: (await import('../models/Product.js')).Product
  },
  leanByDefault: true,
  softDelete: false
});
`,
    // New separate files for adapters/ folder (recommended for simple projects)
    mongooseConnect: `import mongoose from 'mongoose';

export const connectDB = async (uri = process.env.MONGO_URI) => {
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log('✅ MongoDB Connected:', mongoose.connection.host);
  } catch (e) {
    console.error('❌ MongoDB Error:', e.message);
    process.exit(1);
  }
};

mongoose.connection.on('disconnected', () => console.warn('⚠️  MongoDB disconnected'));
mongoose.connection.on('error', (err) => console.error('❌ MongoDB:', err.message));
`,
    mongooseAdapter: `import { createMongooseAdapter } from 'dolphin-server-modules/adapters/mongoose';

// =============================================
// Models यहाँ import गर्नुहोस् (models/ folder बाट)
// =============================================
// import { User, RefreshToken } from '../models/User.js';
// import { Product } from '../models/Product.js';

export const db = createMongooseAdapter({
  // Models import गरेपछि तल राख्नुहोस्
  User: undefined,
  RefreshToken: undefined,

  models: {
    // Product: (await import('../models/Product.js')).Product,
  },
  leanByDefault: true,
  softDelete: false
});
`,
    sequelize: `import { Sequelize } from 'sequelize';

export const sequelize = new Sequelize(
  process.env.DB_NAME || 'dolphin_db',
  process.env.DB_USER || 'root',
  process.env.DB_PASS || '',
  {
    host:    process.env.DB_HOST    || 'localhost',
    dialect: process.env.DB_DIALECT || 'mysql',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
  }
);

export const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Sequelize Connected:', process.env.DB_HOST || 'localhost');
    await sequelize.sync({ alter: process.env.NODE_ENV === 'development' });
  } catch (e) {
    console.error('❌ Sequelize Error:', e.message); process.exit(1);
  }
};
`,
    redis: `import { createClient } from 'redis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export const redisClient = createClient({ url: REDIS_URL });
redisClient.on('error',       (err) => console.error('❌ Redis:', err.message));
redisClient.on('connect',     ()    => console.log('✅ Redis Connected:', REDIS_URL));
redisClient.on('reconnecting',()    => console.warn('⚠️  Redis reconnecting...'));

export const connectRedis = async () => {
  await redisClient.connect().catch(e => { console.error('❌ Redis:', e.message); process.exit(1); });
};

export const cache = {
  set:    (key, value, ttl = 3600) => redisClient.setEx(key, ttl, JSON.stringify(value)),
  get:    async (key)  => { const v = await redisClient.get(key); return v ? JSON.parse(v) : null; },
  del:    (key)        => redisClient.del(key),
  exists: async (key)  => (await redisClient.exists(key)) === 1,
};
`,
    auth: `import { createDolphinAuthController } from 'dolphin-server-modules/auth-controller';
import { db } from '../adapters/db.js'; 

export const auth = createDolphinAuthController(db, {
  jwtSecret: process.env.JWT_SECRET || 'change_in_production',
  accessTokenExpiry:  '15m',
  refreshTokenExpiry: '7d',
});

export const { register, login, refresh, logout, middleware } = auth;
`,
    crud: (name) => `// Auto-generated by dolphin CLI
// Add this to your app.js — no separate controller file needed!

// import { createCrudRouter } from 'dolphin-server-modules/crud';
// import { db }               from './adapters/db.js';
// import { ${name} }          from './models/${name}.js';

// app.use('/api/${name.toLowerCase()}s', createCrudRouter(db, '${name}', { softDelete: true }));
`,
    crudModel: (name) => `import mongoose from 'mongoose';

const ${name.toLowerCase()}Schema = new mongoose.Schema(
  {
    title:       { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    status:      { type: String, enum: ['active','inactive'], default: 'active' },
    userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, versionKey: false }
);

${name.toLowerCase()}Schema.index({ userId: 1, status: 1 });
${name.toLowerCase()}Schema.index({ createdAt: -1 });

export const ${name} = mongoose.model('${name}', ${name.toLowerCase()}Schema);
`,
    authModel: `import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email:           { type: String, required: true, lowercase: true, trim: true },
    password:        { type: String, required: true },
    role:            { type: String, enum: ['user','admin','moderator'], default: 'user' },
    twoFactorEnabled:  { type: Boolean, default: false },
    twoFactorSecret:   { type: String, default: null },
    pending2FASecret:  { type: String, default: null },
    recoveryCodes:     { type: [String], default: [] },
    isActive:          { type: Boolean, default: true },
    lastLoginAt:       { type: Date, default: null },
    // 🔑 Password reset fields — forgotPassword/resetPassword को लागि अनिवार्य
    resetPasswordToken:   { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false }
);
userSchema.index({ email: 1 }, { unique: true });
export const User = mongoose.model('User', userSchema);

const refreshTokenSchema = new mongoose.Schema(
  {
    token:              { type: String, required: true, unique: true, index: true },
    userId:             { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt:          { type: Date, required: true },
    twoFactorVerified:  { type: Boolean, default: false },
    userAgent:          { type: String, default: null },
    ip:                 { type: String, default: null },
  },
  { timestamps: true, versionKey: false }
);
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);
`,
    model: (name) => `import mongoose from 'mongoose';

const ${name.toLowerCase()}Schema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '', maxlength: 2000 },
    isActive:    { type: Boolean, default: true },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform: (_, ret) => { ret.id = ret._id?.toString(); delete ret._id; return ret; }
    }
  }
);

${name.toLowerCase()}Schema.index({ name: 1 });
${name.toLowerCase()}Schema.index({ isActive: 1, createdAt: -1 });

export const ${name} = mongoose.model('${name}', ${name.toLowerCase()}Schema);
`,
    middleware: (name) => `/**
 * ${name} Middleware
 * Usage: app.use(${name.toLowerCase()}Middleware)  वा  app.get('/route', ${name.toLowerCase()}Middleware, handler)
 */
export const ${name.toLowerCase()}Middleware = async (ctx, next) => {
  // TODO: तपाईंको logic यहाँ लेख्नुहोस्
  console.log(\`[${name}] \${ctx.req.method} \${ctx.req.url}\`);
  if (next) await next();
};
`,
    route: (name) => `import { createDolphinRouter } from 'dolphin-server-modules/router';

const router = createDolphinRouter();
const base = '/${name.toLowerCase()}s';

router.get(base, async (ctx) => {
  return { success: true, data: [], message: '${name} list' };
});

router.get(\`\${base}/:id\`, async (ctx) => {
  return { success: true, data: { id: ctx.params.id } };
});

router.post(base, async (ctx) => {
  return ctx.status(201).json({ success: true, data: ctx.body });
});

router.put(\`\${base}/:id\`, async (ctx) => {
  return { success: true, data: { id: ctx.params.id, ...ctx.body } };
});

router.delete(\`\${base}/:id\`, async (ctx) => {
  return { success: true, data: { id: ctx.params.id, deleted: true } };
});

export const ${name.toLowerCase()}Router = router;
`,
    service: (name) => `/**
 * ${name}Service — Business logic layer
 * Controller र Database को बीचको layer
 */
export class ${name}Service {

  static async getAll(filter = {}) {
    // TODO: DB query
    return [];
  }

  static async getById(id) {
    // TODO: DB findById
    return null;
  }

  static async create(data) {
    // TODO: DB create
    return { id: Date.now().toString(), ...data, createdAt: new Date() };
  }

  static async update(id, data) {
    // TODO: DB update
    return { id, ...data, updatedAt: new Date() };
  }

  static async delete(id) {
    // TODO: DB delete
    return { id, deleted: true };
  }
}
`,
    env: `# 🐬 Dolphin Framework — Environment Variables
# ⚠️  यो file .gitignore मा राख्नुहोस् — production मा NEVER commit!

NODE_ENV=development
PORT=3000

# MongoDB
MONGO_URI=mongodb://localhost:27017/dolphin_db

# JWT Secret (कम्तीमा 32 chars)
JWT_SECRET=change_this_ultra_secret_key_in_production_32chars

# Redis (optional — realtime scaling)
# REDIS_URL=redis://localhost:6379

# AI Keys (dolphin chat/generate को लागि)
# GEMINI_API_KEY=your_key_here
# GROQ_API_KEY=your_key_here
# OPENAI_API_KEY=your_key_here

# Local Ollama (optional)
# USE_OLLAMA=true
# OLLAMA_MODEL=gemma3:latest
`,
    // ── Simple mode templates (npx dolphin init --simple) ─────────────────────
    simpleApp: `import { createDolphinServer } from 'dolphin-server-modules/server';
import { connectDB } from './config/db.js';
import { db } from './config/adapter.js';
import { auth } from './controllers/auth.js';

const app = createDolphinServer();

// DB connect
connectDB(process.env.MONGO_URI || 'mongodb://localhost:27017/dolphin_db');

// Full Auth Routing
app.post('/api/auth/register', auth.register);
app.post('/api/auth/login',    auth.login);
app.post('/api/auth/refresh',  auth.refresh);
app.post('/api/auth/logout',   auth.requireAuth, auth.logout);

// Example single-line route
app.get('/ping', (ctx) => {
  return { message: 'pong' };
});

app.get('/health', (ctx) => ({ status: 'ok', ts: new Date().toISOString() }));

const PORT = parseInt(process.env.PORT || '3000');
app.listen(PORT, () => console.log(\`🐬 Dolphin (simple) running on port \${PORT}\`));
`,
    configAdapter: `import { createMongooseAdapter } from 'dolphin-server-modules/adapters/mongoose';

// =============================================
// Models यहाँ import गर्नुहोस् (models/ folder बाट)
// =============================================
import { User, RefreshToken } from '../models/User.js';
// import { Product } from '../models/Product.js';

export const db = createMongooseAdapter({
  User,          // Auth को लागि — required (यहाँ नै registered छ)
  RefreshToken,  // Auth को लागि — required (यहाँ नै registered छ)

  models: {
    // यहाँ CRUD models थप्नुहोस् (User र RefreshToken थप्नु हुन्न — माथि नै छ)
    // double registration भयो भने CRUD ले auth email check bypass गर्छ!
    // उदाहरण:
    // Product,
    // Order,
  },
  leanByDefault: true,
  softDelete: false
});
`,
};
//# sourceMappingURL=index.js.map