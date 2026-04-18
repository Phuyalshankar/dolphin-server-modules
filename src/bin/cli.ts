#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { createDolphinServer } from '../server/server';
import { RealtimeCore } from '../realtime/core';

const args = process.argv.slice(2);
const command = args[0];

const TEMPLATES = {
    app: `const { createDolphinServer } = require('dolphin-server-modules/server');
const app = createDolphinServer();

app.get('/', (ctx) => ctx.json({ message: 'Dolphin Server is running!' }));

app.listen(3000, () => console.log('🐬 Dolphin swimming on port 3000'));`,
    
    mongoose: `const mongoose = require('mongoose');
const { createMongooseAdapter } = require('dolphin-server-modules/adapters/mongoose');

async function connectDB() {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/dolphin_db');
    console.log('✅ MongoDB Connected');
    
    return createMongooseAdapter({
        models: { /* Your Models Here */ }
    });
}

module.exports = connectDB;`,

    sequelize: `const { Sequelize } = require('sequelize');
// Note: This is a skeleton for Dolphin Sequelize Adapter
async function connectDB() {
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
}

module.exports = connectDB;`,

    auth: `const { createDolphinAuthController } = require('dolphin-server-modules/auth-controller');
const { createDolphinRouter } = require('dolphin-server-modules/router');

function setupAuth(dbAdapter, config) {
    const router = createDolphinRouter();
    const auth = createDolphinAuthController(dbAdapter, config);
    
    router.post('/register', auth.register);
    router.post('/login', auth.login);
    router.post('/refresh', auth.refresh);
    router.get('/me', auth.requireAuth, (ctx) => ctx.json(ctx.req.user));
    
    return router;
}

module.exports = setupAuth;`,

    crud: (name: string) => `const { createCRUD } = require('dolphin-server-modules/crud');

function setup${name}CRUD(dbAdapter) {
    const service = createCRUD(dbAdapter, { enforceOwnership: false });
    const COLLECTION = '${name}';
    
    return {
        getAll: async (ctx) => ctx.json(await service.read(COLLECTION, ctx.query)),
        getOne: async (ctx) => ctx.json(await service.readOne(COLLECTION, ctx.params.id)),
        create: async (ctx) => ctx.json(await service.create(COLLECTION, ctx.body)),
        update: async (ctx) => ctx.json(await service.updateOne(COLLECTION, ctx.params.id, ctx.body)),
        delete: async (ctx) => ctx.json(await service.deleteOne(COLLECTION, ctx.params.id))
    };
}

module.exports = setup${name}CRUD;`
};

async function run() {
    switch (command) {
        case 'serve':
            const port = parseInt(args.find(arg => arg.startsWith('--port='))?.split('=')[1] || '3000');
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
                    dependencies: { "dolphin-server-modules": "^2.2.2" }
                }, null, 2));
            }
            console.log('✅ Created app.js and initial setup.');
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
                fs.writeFileSync(path.join(process.cwd(), `${name.toLowerCase()}-crud.js`), (TEMPLATES.crud as any)(name));
                console.log(`✅ Added CRUD Controller template for "${name}" to ${name.toLowerCase()}-crud.js`);
            } else {
                console.log('❌ Unknown type. Use "adapter", "auth", or "crud".');
            }
            break;

        case 'help':
        default:
            console.log(`
🐬 Dolphin Framework CLI
Commands:
  serve              Start a basic development server
  init               Bootstrap a new Dolphin project
  add adapter <type> Add a database adapter (mongoose, sequelize)
  add auth           Add a pre-configured Auth controller
  add crud <Name>    Add a pre-configured CRUD controller
  
Options:
  --port=3000        Specify port for serve command
            `);
            break;
    }
}

run().catch(err => {
    console.error('❌ CLI Error:', err);
});
