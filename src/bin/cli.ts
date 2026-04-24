#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import https from 'https';
import { createDolphinServer } from '../server/server';
import { RealtimeCore } from '../realtime/core';

const args = process.argv.slice(2);
const command = args[0];

const TEMPLATES = {
    app: `import { createDolphinServer } from 'dolphin-server-modules/server';
const app = createDolphinServer();

app.get('/', (ctx) => ctx.json({ message: 'Dolphin Server is running!' }));

app.listen(3000, () => console.log('🐬 Dolphin swimming on port 3000'));`,
    
    mongoose: `import mongoose from 'mongoose';
import { createMongooseAdapter } from 'dolphin-server-modules/adapters/mongoose';

export async function connectDB(models = {}) {
    const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/dolphin_db';
    await mongoose.connect(uri);
    console.log('✅ MongoDB Connected');
    
    return createMongooseAdapter({
        models: { ...models }
    });
}`,

    sequelize: `import { Sequelize } from 'sequelize';
// Note: This is a skeleton for Dolphin Sequelize Adapter
export async function connectDB() {
    const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS, {
        host: process.env.DB_HOST,
        dialect: 'mysql' // or 'postgres', 'sqlite'
    });
    
    try {
        await sequelize.authenticate();
        console.log('✅ SQL Database Connected');
    } catch (error) {
        console.error('❌ Unable to connect to the database:', error);
    }
    
    return sequelize;
}`,

    auth: `import { createDolphinAuthController } from 'dolphin-server-modules/auth-controller';
import { createDolphinRouter } from 'dolphin-server-modules/router';

export function setupAuth(dbAdapter, config) {
    const router = createDolphinRouter();
    const auth = createDolphinAuthController(dbAdapter, config);
    
    router.post('/register', auth.register);
    router.post('/login', auth.login);
    router.post('/refresh', auth.refresh);
    router.get('/me', auth.requireAuth, (ctx) => ctx.json(ctx.req.user));
    
    return router;
}`,

    crud: (name: string) => `import { createCRUD } from 'dolphin-server-modules/crud';

export function setup${name}CRUD(dbAdapter) {
    const service = createCRUD(dbAdapter, { enforceOwnership: false });
    const COLLECTION = '${name}';
    
    return {
        getAll: async (ctx) => ctx.json(await service.read(COLLECTION, ctx.query)),
        getOne: async (ctx) => ctx.json(await service.readOne(COLLECTION, ctx.params.id)),
        create: async (ctx) => ctx.json(await service.create(COLLECTION, ctx.body)),
        update: async (ctx) => ctx.json(await service.updateOne(COLLECTION, ctx.params.id, ctx.body)),
        delete: async (ctx) => ctx.json(await service.deleteOne(COLLECTION, ctx.params.id))
    };
}`,

    authModel: `import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String },
    role: { type: String, default: 'user' },
    is2FAEnabled: { type: Boolean, default: false },
    twoFASecret: { type: String },
    recoveryCodes: [{ type: String }],
    createdAt: { type: Date, default: Date.now }
});

const RefreshTokenSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    token: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now }
});

export const User = mongoose.model('User', UserSchema);
export const RefreshToken = mongoose.model('RefreshToken', RefreshTokenSchema);`
};

function loadEnv() {
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        content.split('\n').forEach(line => {
            const [key, ...valueParts] = line.split('=');
            if (key && valueParts.length > 0) {
                const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
                process.env[key.trim()] = value;
            }
        });
    }
}

async function run() {
    loadEnv();
    switch (command) {
        case 'generate':
            const requestedModel = args.find(arg => arg.startsWith('--model='))?.split('=')[1] || 'gemini-flash-latest';
            const prompt = args.filter(arg => !arg.startsWith('--')).slice(1).join(' ');
            const apiKey = process.env.GEMINI_API_KEY;

            if (!apiKey) {
                console.log('❌ Error: GEMINI_API_KEY environment variable is not set.');
                console.log('💡 Get a free key at: https://aistudio.google.com/app/apikey');
                break;
            }

            if (!prompt) {
                console.log('❌ Please provide a prompt. Example: dolphin generate "a library management system"');
                break;
            }

            const fallbackModels = ['gemini-flash-latest', 'gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-pro-latest'];
            const modelsToTry = [requestedModel, ...fallbackModels.filter(m => m !== requestedModel)];
            const versions = ['v1beta', 'v1'];
            
            const tryGenerate = (modelIndex: number, versionIndex: number) => {
                if (modelIndex >= modelsToTry.length) {
                    console.log('❌ All AI models failed. Please ensure Generative Language API is enabled in Google AI Studio for your key.');
                    return;
                }

                if (versionIndex >= versions.length) {
                    return tryGenerate(modelIndex + 1, 0);
                }

                const currentModel = modelsToTry[modelIndex];
                const currentVersion = versions[versionIndex];
                console.log(`🤖 AI (${currentModel} via ${currentVersion}) is swimming with Dolphin...`);

                const aiData = JSON.stringify({
                    contents: [{ parts: [{ text: `Generate a production-ready Node.js file using dolphin-server-modules. 
                    Rules:
                    1. Use ESM 'import' instead of 'require'.
                    2. Use 'const app = createDolphinServer();' from 'dolphin-server-modules/server'.
                    3. Use unified context '(ctx) => { ... }' instead of '(req, res)'.
                    4. Return objects directly for JSON response.
                    5. No markdown backticks, no explanations.
                    Context: ${prompt}. Return ONLY raw JS code.` }] }]
                });

                const options = {
                    hostname: 'generativelanguage.googleapis.com',
                    path: `/${currentVersion}/models/${currentModel}:generateContent?key=${apiKey}`,
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                };

                const req = https.request(options, (res) => {
                    let body = '';
                    res.on('data', (d) => body += d);
                    res.on('end', () => {
                        try {
                            const json = JSON.parse(body);
                            if (json.error) {
                                console.log(`⚠️ ${currentModel} (${currentVersion}) unavailable. Error: ${json.error.status}. Trying next...`);
                                tryGenerate(modelIndex, versionIndex + 1);
                                return;
                            }
                        const rawCode = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
                            if (rawCode) {
                            const codeMatch = rawCode.match(/(\/\*[\s\S]*?\*\/|\/\/.*|[\s\S])*?(import|const|let|var|app|function)[\s\S]*/);
                            const code = (codeMatch ? codeMatch[0] : rawCode).replace(/```javascript|```js|```/g, '').trim();
                                fs.writeFileSync(path.join(process.cwd(), 'ai-generated-app.js'), code);
                                console.log(`✅ Success! Code generated using ${currentModel} in ai-generated-app.js`);
                            } else {
                                tryGenerate(modelIndex, versionIndex + 1);
                            }
                        } catch (e) { tryGenerate(modelIndex, versionIndex + 1); }
                    });
                });
                req.on('error', () => tryGenerate(modelIndex, versionIndex + 1));
                req.write(aiData);
                req.end();
            };

            tryGenerate(0, 0);
            break;

        case 'generate-full':
            const fullRequestedModel = args.find(arg => arg.startsWith('--model='))?.split('=')[1] || 'gemini-1.5-flash';
            const fullPrompt = args.filter(arg => !arg.startsWith('--')).slice(1).join(' ');
            const fullApiKey = process.env.GEMINI_API_KEY;

            if (!fullApiKey) {
                console.log('❌ Error: GEMINI_API_KEY environment variable is not set.');
                break;
            }

            if (!fullPrompt) {
                console.log('❌ Please provide a prompt. Example: dolphin generate-full "a laundry management system"');
                break;
            }

            console.log(`🤖 AI is architecting a full production-grade system...`);

            const tryGenerateFull = (modelIndex: number, versionIndex: number) => {
                const currentModel = ['gemini-1.5-flash', 'gemini-1.5-pro'][modelIndex] || 'gemini-1.5-flash';
                const currentVersion = ['v1beta', 'v1'][versionIndex] || 'v1beta';

                const aiData = JSON.stringify({
                    contents: [{ parts: [{ text: `Generate a full production-ready modular Node.js project structure using dolphin-server-modules. 
                    Rules:
                    1. Return ONLY a valid JSON object.
                    2. Keys are file paths (e.g., "routes/user.js", "models/User.js", "app.js").
                    3. Values are the file contents as strings.
                    4. Use ESM 'import'.
                    5. Use Dolphin unified context '(ctx) => { ... }'.
                    6. Include folders: models, controllers, routes, middleware, config.
                    Context: ${fullPrompt}.` }] }]
                });

                const options = {
                    hostname: 'generativelanguage.googleapis.com',
                    path: `/${currentVersion}/models/${currentModel}:generateContent?key=${fullApiKey}`,
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                };

                const req = https.request(options, (res) => {
                    let body = '';
                    res.on('data', (d) => body += d);
                    res.on('end', () => {
                        try {
                            const json = JSON.parse(body);
                            const rawJson = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
                            const jsonMatch = rawJson.match(/\{[\s\S]*\}/);
                            if (jsonMatch) {
                                const files = JSON.parse(jsonMatch[0]);
                                Object.keys(files).forEach(filePath => {
                                    const fullPath = path.join(process.cwd(), filePath);
                                    const dirPath = path.dirname(fullPath);
                                    if (!fs.existsSync(dirPath)) {
                                        fs.mkdirSync(dirPath, { recursive: true });
                                    }
                                    fs.writeFileSync(fullPath, files[filePath]);
                                    console.log(`📄 Generated: ${filePath}`);
                                });
                                console.log('✅ Full project architected successfully! 🐬');
                            } else {
                                console.log('❌ AI failed to return a valid project structure. Try again.');
                            }
                        } catch (e) { console.log('❌ Error parsing AI response.'); }
                    });
                });
                req.write(aiData);
                req.end();
            };

            tryGenerateFull(0, 0);
            break;

        case 'clean':
            const filesToClean = ['ai-generated-app.js', 'ai-test-output.js'];
            filesToClean.forEach(file => {
                const filePath = path.join(process.cwd(), file);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log(`🗑️ Deleted: ${file}`);
                }
            });
            console.log('✅ Cleanup complete.');
            break;

        case 'serve':
            let portStr = args.find(arg => arg.startsWith('--port='))?.split('=')[1];
            if (!portStr) {
                const portIdx = args.indexOf('--port');
                if (portIdx !== -1 && args[portIdx + 1]) portStr = args[portIdx + 1];
            }
            const port = parseInt(portStr || '3000');
            const rt = new RealtimeCore({ debug: true });
            const server = createDolphinServer({ realtime: rt });
            server.get('/', (ctx) => ctx.html('<h1>Dolphin CLI Static Server</h1>'));
            server.listen(port, () => console.log(`✅ Dolphin Server running at http://localhost:${port}`));
            break;

        case 'init':
            console.log('🏗️ Initializing Dolphin Project...');
            fs.writeFileSync(path.join(process.cwd(), 'app.js'), TEMPLATES.app);
            if (!fs.existsSync(path.join(process.cwd(), 'package.json'))) {
                fs.writeFileSync(path.join(process.cwd(), 'package.json'), JSON.stringify({
                    name: path.basename(process.cwd()),
                    version: '1.0.0',
                    main: 'app.js',
                    type: 'module',
                    dependencies: { 
                        "dolphin-server-modules": "^2.2.2",
                        "mongoose": "^8.0.0",
                        "zod": "^3.22.0"
                    }
                }, null, 2));
                console.log('✅ Created package.json with core dependencies.');
            } else {
                console.log('⚠️ package.json already exists. Skipping...');
            }

            if (!fs.existsSync(path.join(process.cwd(), '.gitignore'))) {
                fs.writeFileSync(path.join(process.cwd(), '.gitignore'), '.env\nnode_modules\ndist\n.DS_Store');
                console.log('✅ Created .gitignore');
            }
            break;

        case 'add':
            const type = args[1]; // adapter, auth, crud
            const name = args[2] || 'Default'; 
            
            if (type === 'adapter') {
                if (name === 'mongoose') {
                    fs.writeFileSync(path.join(process.cwd(), 'db.js'), TEMPLATES.mongoose);
                    console.log('✅ Added Mongoose Adapter template to db.js');
                } else if (name === 'sequelize') {
                    fs.writeFileSync(path.join(process.cwd(), 'db-sql.js'), TEMPLATES.sequelize);
                    console.log('✅ Added Sequelize (SQL) Adapter template to db-sql.js');
                } else {
                    console.log('❌ Unknown adapter. Use "mongoose" or "sequelize".');
                }
            } else if (type === 'auth') {
                fs.writeFileSync(path.join(process.cwd(), 'auth-router.js'), TEMPLATES.auth);
                console.log('✅ Added Auth Controller template to auth-router.js');
            } else if (type === 'crud') {
                const crudTemplate = typeof TEMPLATES.crud === 'function' ? TEMPLATES.crud(name) : '';
                fs.writeFileSync(path.join(process.cwd(), `${name.toLowerCase()}-crud.js`), crudTemplate);
                console.log(`✅ Added CRUD Controller template for "${name}" to ${name.toLowerCase()}-crud.js`);
            } else {
                console.log('❌ Unknown type. Use "adapter", "auth", or "crud".');
            }
            break;

        case 'mongo-auth-model':
            const modelsDir = path.join(process.cwd(), 'models');
            if (!fs.existsSync(modelsDir)) {
                fs.mkdirSync(modelsDir);
            }
            fs.writeFileSync(path.join(modelsDir, 'auth-models.js'), TEMPLATES.authModel);
            console.log('✅ Generated fixed Auth models (User, RefreshToken) in models/auth-models.js');
            break;

        case 'init-prod':
            console.log('🚀 Scaffolding Production-Ready Dolphin Project...');
            const dirs = ['models', 'controllers', 'routes', 'middleware', 'services', 'config'];
            dirs.forEach(dir => {
                const dirPath = path.join(process.cwd(), dir);
                if (!fs.existsSync(dirPath)) {
                    fs.mkdirSync(dirPath);
                    console.log(`📁 Created: /${dir}`);
                }
            });

            // Create basic files in the structure
            fs.writeFileSync(path.join(process.cwd(), 'app.js'), TEMPLATES.app);
            fs.writeFileSync(path.join(process.cwd(), 'config', 'db.js'), TEMPLATES.mongoose);
            
            if (!fs.existsSync(path.join(process.cwd(), 'package.json'))) {
                fs.writeFileSync(path.join(process.cwd(), 'package.json'), JSON.stringify({
                    name: path.basename(process.cwd()),
                    version: '1.0.0',
                    main: 'app.js',
                    type: 'module',
                    dependencies: { 
                        "dolphin-server-modules": "^2.2.4",
                        "mongoose": "^8.0.0",
                        "zod": "^3.22.0"
                    }
                }, null, 2));
            }

            if (!fs.existsSync(path.join(process.cwd(), '.gitignore'))) {
                fs.writeFileSync(path.join(process.cwd(), '.gitignore'), '.env\nnode_modules\ndist\n.DS_Store');
                console.log('✅ Created .gitignore');
            }
            console.log('✅ Production scaffolding complete. Start swimming! 🐬');
            break;

        case 'help':
        default:
            console.log(`
🐬 Dolphin Framework CLI
Commands:
  serve              Start a basic development server
  init               Bootstrap a basic Dolphin project
  init-prod          Scaffold a production-grade folder structure
  generate <prompt>  AI-powered single-file API generation
  generate-full <prompt> AI-powered full project architecture (folders + files)
  clean              Remove AI generated files
  add adapter <type> Add a database adapter (mongoose, sequelize)
  add auth           Add a pre-configured Auth controller
  add crud <Name>    Add a pre-configured CRUD controller
  mongo-auth-model   Generate fixed Mongoose models for Auth (User, RefreshToken)
  generate "prompt" --model=gemini-1.5-pro (Custom AI model support)
  
Options:
  --port=3000        Specify port for serve command
            `);
            break;
    }
}

run().catch(err => {
    console.error('❌ CLI Error:', err);
});
