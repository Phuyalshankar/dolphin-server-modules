export const TEMPLATES = {
    app: `import { createDolphinServer } from 'dolphin-server-modules/server';
import { createMongooseAdapter } from 'dolphin-server-modules/adapters/mongoose';
import { createDolphinAuthController } from 'dolphin-server-modules/auth-controller';

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

app.listen(3000, () => console.log('🐬 Dolphin Production Server is swimming on port 3000'));
`,
    mongoose: `import mongoose from 'mongoose';
export const connectDB = async (uri) => {
    try {
        await mongoose.connect(uri);
        console.log('✅ MongoDB Connected');
    } catch (e) {
        console.error('❌ DB Error:', e);
    }
};`,
    sequelize: `import { Sequelize } from 'sequelize';
export const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS, {
    host: process.env.DB_HOST || 'localhost',
    dialect: 'mysql',
    logging: false
});

export const connectDB = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ MySQL/Sequelize Connected');
    } catch (e) {
        console.error('❌ DB Error:', e);
    }
};`,
    auth: `import { createDolphinAuthController } from 'dolphin-server-modules/auth-controller';
import { User } from '../models/User.js';

// This is a production-ready Auth Controller using Dolphin Modules
export const auth = createDolphinAuthController({
    secret: process.env.JWT_SECRET || 'your_ultra_secret_key',
    model: User, // In a real app, you'd pass a Database Adapter
    issuer: 'DolphinApp'
});

export const register = auth.register;
export const login = auth.login;
`,
    crud: (name: string) => `import { createCrudController } from 'dolphin-server-modules/crud';
import { ${name} } from '../models/${name}.js';

// Fully automated CRUD controller for ${name}
export const ${name.toLowerCase()}Controller = createCrudController(
    ${name}, // Mongoose Model
    '${name.toLowerCase()}s', // Collection Name
    { softDelete: true, enforceOwnership: true }
);

export const getAll = ${name.toLowerCase()}Controller.getAll;
export const getOne = ${name.toLowerCase()}Controller.getOne;
export const create = ${name.toLowerCase()}Controller.create;
export const update = ${name.toLowerCase()}Controller.update;
export const remove = ${name.toLowerCase()}Controller.delete;
`,
    crudModel: (name: string) => `import mongoose from 'mongoose';

const ${name.toLowerCase()}Schema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    description: { type: String },
    status: { type: String, enum: ['pending', 'completed'], default: 'pending' }
}, { timestamps: true });

export const ${name} = mongoose.model('${name}', ${name.toLowerCase()}Schema);
`,
    authModel: `import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'user' },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, default: null },
    pending2FASecret: { type: String, default: null },
    recoveryCodes: { type: [String], default: [] }
}, { timestamps: true });

export const User = mongoose.model('User', userSchema);

const refreshTokenSchema = new mongoose.Schema({
    token: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true },
    twoFactorVerified: { type: Boolean, default: false }
}, { timestamps: true });

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // Auto-delete expired tokens

export const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);
`
};
