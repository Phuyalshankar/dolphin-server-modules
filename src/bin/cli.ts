#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { createServer } from 'http';
import net from 'net';
import { fileURLToPath } from 'url';
import { AIService } from '../services/ai-service.js';
import { CLIUI } from '../utils/ui.js';
import { TEMPLATES } from '../templates/index.js';

const args = process.argv.slice(2);
const command = args[0] || 'help';

// Version — package.json बाट dynamic पढ्ने
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8'));
const VERSION: string = pkg.version;

// .env loader
const envFilePath = path.join(process.cwd(), '.env');
if (fs.existsSync(envFilePath)) {
    fs.readFileSync(envFilePath, 'utf8').split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) return;
        const key = trimmed.slice(0, eqIdx).trim();
        const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
        if (key && !process.env[key]) process.env[key] = value;
    });
}

const aiConfig = {
    apiKey: (process.env.DOLPHIN_AI_KEY || process.env.GEMINI_API_KEY || '').trim(),
    baseUrl: process.env.DOLPHIN_AI_BASE_URL,
    model: process.env.DOLPHIN_AI_MODEL,
};
const useOllama = process.env.USE_OLLAMA === 'true';
const hasAnyKey = aiConfig.apiKey || process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;

if (!hasAnyKey && !useOllama && ['generate', 'generate-full', 'chat'].includes(command)) {
    CLIUI.error('API Key फेला परेन! .env मा DOLPHIN_AI_KEY, GEMINI_API_KEY, वा GROQ_API_KEY राख्नुहोस्।');
    process.exit(1);
}

const ai = new AIService(aiConfig);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ensureDir(dir: string) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writeFile(filePath: string, content: string, label?: string) {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, content);
    console.log(`  📄 Created: ${label || path.relative(process.cwd(), filePath)}`);
}

function capitalize(s: string) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * app.js मा CRUD import र route line automatically inject गर्ने
 */
function injectIntoAppJs(N: string, plural: string): boolean {
    const appPath = path.join(process.cwd(), 'app.js');
    if (!fs.existsSync(appPath)) {
        console.log('  ⚠️  app.js फेला परेन — manually थप्नुहोस्।');
        return false;
    }

    let src = fs.readFileSync(appPath, 'utf8');
    let changed = false;

    // ── 1. createCrudRouter import (नभएको भए) ──────────────────────────────
    if (!src.includes("'dolphin-server-modules/crud'")) {
        // last import line को अन्त्यमा थप्ने
        const lastImportIdx = src.lastIndexOf('\nimport ');
        const insertPos = lastImportIdx !== -1
            ? src.indexOf('\n', lastImportIdx + 1) + 1
            : 0;
        src = src.slice(0, insertPos)
            + `import { createCrudRouter } from 'dolphin-server-modules/crud';\n`
            + src.slice(insertPos);
        changed = true;
    }

    // ── 2. Model import (नभएको भए) ──────────────────────────────────────────
    if (!src.includes(`'./models/${N}.js'`) && !src.includes(`"./models/${N}.js"`)) {
        const lastImportIdx2 = src.lastIndexOf('\nimport ');
        const insertPos2 = lastImportIdx2 !== -1
            ? src.indexOf('\n', lastImportIdx2 + 1) + 1
            : 0;
        src = src.slice(0, insertPos2)
            + `import { ${N} } from './models/${N}.js';\n`
            + src.slice(insertPos2);
        changed = true;
    }

    // ── 3. app.use() — app.listen() भन्दा पहिले inject गर्ने ─────────────────
    const routeLine = `app.use('/api/${plural}', createCrudRouter(db, '${N}', { softDelete: true }));`;
    if (!src.includes(`'/api/${plural}'`) && !src.includes(`"/api/${plural}"`)) {
        const listenIdx = src.indexOf('app.listen(');
        if (listenIdx !== -1) {
            src = src.slice(0, listenIdx) + routeLine + '\n\n' + src.slice(listenIdx);
        } else {
            src += '\n' + routeLine + '\n';
        }
        changed = true;
    }

    if (changed) {
        fs.writeFileSync(appPath, src);
        console.log('  ✏️  Updated: app.js');
    } else {
        console.log('  ⏭️  app.js — already up-to-date');
    }
    return true;
}

/**
 * adapters/db.js (वा config/adapter.js) मा model import र registration inject गर्ने
 */
function injectIntoDbAdapter(N: string): boolean {
    const candidates = [
        path.join(process.cwd(), 'adapters', 'db.js'),
        path.join(process.cwd(), 'config', 'adapter.js'),
        path.join(process.cwd(), 'config', 'db.js'),
    ];
    const dbPath = candidates.find(p => fs.existsSync(p));
    if (!dbPath) {
        console.log('  ⚠️  adapters/db.js फेला परेन — manually थप्नुहोस्।');
        return false;
    }

    let src = fs.readFileSync(dbPath, 'utf8');
    const relPath = path.relative(process.cwd(), dbPath);
    let changed = false;

    // ── 1. Model import (नभएको भए) ──────────────────────────────────────────
    const modelImport = `import { ${N} } from '../models/${N}.js';`;
    if (!src.includes(`'../models/${N}.js'`) && !src.includes(`"../models/${N}.js"`)) {
        const lastImportIdx = src.lastIndexOf('\nimport ');
        const insertPos = lastImportIdx !== -1
            ? src.indexOf('\n', lastImportIdx + 1) + 1
            : 0;
        src = src.slice(0, insertPos) + modelImport + '\n' + src.slice(insertPos);
        changed = true;
    }

    // ── 2. models: { } object मा model थप्ने ────────────────────────────────
    if (!src.includes(`${N}:`)) {
        const modelsRegex = /models\s*:\s*\{([^}]*)\}/;
        const match = modelsRegex.exec(src);
        if (match) {
            const inner = match[1];
            const hasContent = inner.trim().length > 0;
            const newInner = hasContent
                ? inner.trimEnd() + `\n    ${N},\n  `
                : `\n    ${N},\n  `;
            src = src.replace(modelsRegex, `models: {${newInner}}`);
            changed = true;
        } else {
            // models: block छैन — createMongooseAdapter({ ... }) को closing } भन्दा अघि थप्ने
            src = src.replace(
                /(createMongooseAdapter\([\s\S]*?)(\}\s*\)\s*;)/,
                (_, body, close) => `${body}  ${N},\n${close}`
            );
            changed = true;
        }
    }

    if (changed) {
        fs.writeFileSync(dbPath, src);
        console.log(`  ✏️  Updated: ${relPath}`);
    } else {
        console.log(`  ⏭️  ${relPath} — already up-to-date`);
    }
    return true;
}

/** TCP port check — live connection test गर्ने */
function checkTcpPort(host: string, port: number, timeoutMs = 4000): Promise<boolean> {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(timeoutMs);
        socket.once('connect', () => { socket.destroy(); resolve(true); });
        socket.once('error',   () => { socket.destroy(); resolve(false); });
        socket.once('timeout', () => { socket.destroy(); resolve(false); });
        socket.connect(port, host);
    });
}

/** URI बाट host र port निकाल्ने */
function parseUri(uri: string): { host: string; port: number } {
    try {
        const u = new URL(uri);
        const defaults: Record<string, number> = {
            'mongodb:': 27017, 'mongodb+srv:': 27017,
            'redis:': 6379, 'rediss:': 6380,
        };
        return {
            host: u.hostname || 'localhost',
            port: parseInt(u.port || '') || defaults[u.protocol] || 3000,
        };
    } catch {
        return { host: 'localhost', port: 27017 };
    }
}

// ─── Commands ─────────────────────────────────────────────────────────────────

async function run() {
    switch (command) {

        // ── serve ────────────────────────────────────────────────────────────
        case 'serve': {
            const port = parseInt(args.find(a => a.startsWith('--port='))?.split('=')[1] || '3000');
            CLIUI.heading(`Dolphin Dev Server — port ${port}`);
            const server = createServer((req, res) => {
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end('🐬 Dolphin Server is swimming!\n');
            });
            server.listen(port, () => {
                CLIUI.success(`Server is live at http://localhost:${port}`);
                console.log('  Ctrl+C थिचेर रोक्नुहोस्।');
            });
            break;
        }

        // ── connect mongoose|redis ───────────────────────────────────────────
        case 'connect': {
            const dbType = args[1];
            const uriArg  = args[2];

            if (dbType === 'mongoose' || dbType === 'mongo' || dbType === 'mongodb') {
                const uri = uriArg || process.env.MONGO_URI || 'mongodb://localhost:27017';
                CLIUI.heading('MongoDB Connection Test');
                console.log(`  URI: ${uri.replace(/:\/\/[^@]+@/, '://***@')}`);

                // Step 1: TCP check
                CLIUI.startSpinner('TCP ping...');
                const { host, port } = parseUri(uri);
                const tcpOk = await checkTcpPort(host, port);
                CLIUI.stopSpinner(tcpOk, tcpOk ? `Host reachable: ${host}:${port}` : `Cannot reach ${host}:${port}`);

                if (!tcpOk) {
                    console.log('\n  \x1b[33mFix — MongoDB start गर्नुहोस्:\x1b[0m');
                    console.log('    brew services start mongodb-community  (macOS)');
                    console.log('    sudo systemctl start mongod             (Linux)');
                    console.log('    mongod                                  (manual)');
                    process.exit(1);
                }

                // Step 2: Mongoose check
                CLIUI.startSpinner('Mongoose handshake...');
                try {
                    const mongoose = await import('mongoose');
                    await mongoose.default.connect(uri, { serverSelectionTimeoutMS: 5000 });
                    const dbHost = mongoose.default.connection.host;
                    await mongoose.default.disconnect();
                    CLIUI.stopSpinner(true, `Connected! Host: ${dbHost}`);
                    CLIUI.success('MongoDB तयार छ। MONGO_URI .env मा राख्नुहोस्।');
                } catch (e: any) {
                    CLIUI.stopSpinner(false, e.message);
                    CLIUI.error('Mongoose connection failed. URI सही छ?');
                    process.exit(1);
                }

            } else if (dbType === 'redis') {
                const uri = uriArg || process.env.REDIS_URL || 'redis://localhost:6379';
                CLIUI.heading('Redis Connection Test');
                console.log(`  URI: ${uri}`);

                CLIUI.startSpinner('TCP ping...');
                const { host, port } = parseUri(uri);
                const tcpOk = await checkTcpPort(host, port);
                CLIUI.stopSpinner(tcpOk, tcpOk ? `Host reachable: ${host}:${port}` : `Cannot reach ${host}:${port}`);

                if (!tcpOk) {
                    console.log('\n  \x1b[33mFix — Redis start गर्नुहोस्:\x1b[0m');
                    console.log('    brew services start redis    (macOS)');
                    console.log('    sudo systemctl start redis   (Linux)');
                    console.log('    redis-server                 (manual)');
                    process.exit(1);
                }

                CLIUI.startSpinner('Redis PING...');
                try {
                    const { createClient } = await import('redis' as any);
                    const client = (createClient as any)({ url: uri });
                    await client.connect();
                    const pong = await client.ping();
                    await client.quit();
                    CLIUI.stopSpinner(pong === 'PONG', `Redis replied: ${pong}`);
                    CLIUI.success('Redis तयार छ!');
                } catch {
                    CLIUI.stopSpinner(true, 'TCP OK (redis package: npm install redis)');
                }

            } else {
                CLIUI.error('Usage:');
                console.log('  dolphin connect mongoose [uri]');
                console.log('  dolphin connect redis    [uri]');
            }
            break;
        }

        // ── generate ─────────────────────────────────────────────────────────
        case 'generate': {
            const prompt = args.slice(1).join(' ');
            if (!prompt) return CLIUI.error('Usage: dolphin generate "your prompt"');
            CLIUI.startSpinner('AI is generating code');
            try {
                const response = await ai.request(prompt, 'Return ONLY raw JavaScript code. No markdown.');
                const cleanCode = response.replace(/```javascript|```js|```/g, '').trim();
                fs.writeFileSync(path.join(process.cwd(), 'ai-generated.js'), cleanCode);
                CLIUI.stopSpinner(true, 'File generated: ai-generated.js');
            } catch (e: any) {
                CLIUI.stopSpinner(false, e.message);
            }
            break;
        }

        // ── generate-full ────────────────────────────────────────────────────
        case 'generate-full': {
            const fullPrompt = args.slice(1).join(' ');
            if (!fullPrompt) return CLIUI.error('Usage: dolphin generate-full "project description"');
            CLIUI.startSpinner('Architecting full project structure');
            try {
                const sysPrompt = `You are a Dolphin Framework expert. Generate a production-ready backend project.
Use: createDolphinServer(), createMongooseAdapter({User,RefreshToken}), createDolphinAuthController(), createCrudController().
Return ONLY a JSON object: {filePath: fileContent}. No markdown.`;
                const response = await ai.request(fullPrompt, sysPrompt);
                const jsonMatch = response.match(/\{[\s\S]*\}/);
                const cleaned = jsonMatch ? jsonMatch[0] : response.replace(/```json|```/g, '').trim();
                let files: Record<string, string>;
                try {
                    files = JSON.parse(cleaned);
                } catch {
                    const sanitized = cleaned.replace(/[\x00-\x1F\x7F-\x9F]/g, (c: string) =>
                        c === '\n' ? '\\n' : c === '\r' ? '\\r' : c === '\t' ? '\\t' : ''
                    );
                    files = JSON.parse(sanitized);
                }
                Object.entries(files).forEach(([fPath, content]) => {
                    const fullPath = path.join(process.cwd(), fPath);
                    if (fPath === '.env' && fs.existsSync(fullPath)) {
                        console.log('  ⚠️  Skipped: .env'); return;
                    }
                    ensureDir(path.dirname(fullPath));
                    fs.writeFileSync(fullPath, content);
                    console.log(`  📄 Created: ${fPath}`);
                });
                const dotEnv = path.join(process.cwd(), '.env');
                if (!fs.existsSync(dotEnv)) { fs.writeFileSync(dotEnv, TEMPLATES.env); console.log('  📄 Created: .env'); }
                CLIUI.stopSpinner(true, 'Project architected!');
            } catch (e: any) {
                CLIUI.stopSpinner(false, e.message);
            }
            break;
        }

        // ── chat ─────────────────────────────────────────────────────────────
        case 'chat': {
            import('../ai/dolphin-agent/index.js')
                .then(m => { const a = m.initAgentHook({ framework: 'dolphin', autoGenerateEnv: false }); a.interactiveChat(); })
                .catch(err => CLIUI.error(`[Dolphin-Agent] ${err.message}`));
            break;
        }

        // ── init / init-prod ─────────────────────────────────────────────────
        case 'init':
        case 'init-prod': {
            CLIUI.heading('Production Project Scaffold (Decoupled Mongoose Adapters)');
            const dirs = ['models', 'adapters'];
            dirs.forEach(d => { ensureDir(path.join(process.cwd(), d)); console.log(`  📁 ${d}/`); });

            const files: [string, string][] = [
                ['app.js',                 TEMPLATES.app],
                ['adapters/connection.js', (TEMPLATES as any).adaptersConnection],
                ['adapters/db.js',         (TEMPLATES as any).adaptersDbDecoupled],
                ['models/User.js',         TEMPLATES.authModel],
                ['.env',                   TEMPLATES.env],
                ['.gitignore',             'node_modules/\ndist/\n.env\n*.log\n'],
            ];
            files.forEach(([rel, content]) => {
                const full = path.join(process.cwd(), rel);
                if (!fs.existsSync(full)) { fs.writeFileSync(full, content); console.log(`  📄 Created: ${rel}`); }
            });

            CLIUI.success('Decoupled project structure ready!');
            console.log('\n  Next steps:');
            console.log('  1. npm install dolphin-server-modules mongoose');
            console.log('  2. dolphin connect mongoose     — DB test');
            console.log('  3. node app.js                  — Server start');

            import('../ai/dolphin-agent/index.js')
                .then(m => m.initAgentHook({ framework: 'dolphin', autoGenerateEnv: true }))
                .catch(() => {});
            break;
        }

        // ── add ──────────────────────────────────────────────────────────────
        case 'add': {
            const sub  = args[1];
            const name = args[2];

            // add adapter
            if (sub === 'adapter') {
                const type = name || '';
                const configDir = path.join(process.cwd(), 'config');
                const adaptersDir = path.join(process.cwd(), 'adapters');

                if (['mongoose', 'mongo', 'mongodb'].includes(type)) {
                    writeFile(path.join(adaptersDir, 'connection.js'), (TEMPLATES as any).adaptersConnection, 'adapters/connection.js');
                    writeFile(path.join(adaptersDir, 'db.js'), (TEMPLATES as any).adaptersDbDecoupled, 'adapters/db.js');
                    CLIUI.success('Mongoose adapter added!');
                    console.log('\n  Usage: import { connectDB } from \'./adapters/connection.js\';');
                    console.log('         import { db } from \'./adapters/db.js\';');

                } else if (['sequelize', 'mysql', 'postgres', 'sql'].includes(type)) {
                    writeFile(path.join(configDir, 'db.js'), TEMPLATES.sequelize, 'config/db.js');
                    CLIUI.success('Sequelize adapter added!');
                    console.log('\n  MySQL:      npm install sequelize mysql2');
                    console.log('  PostgreSQL: npm install sequelize pg pg-hstore');

                } else if (type === 'redis') {
                    writeFile(path.join(configDir, 'redis.js'), TEMPLATES.redis, 'config/redis.js');
                    CLIUI.success('Redis adapter added!');
                    console.log('\n  Install: npm install redis');
                    console.log('  Usage:   import { connectRedis, cache } from \'./config/redis.js\';');

                } else {
                    CLIUI.error('Unknown adapter. Available: mongoose | sequelize | redis');
                    console.log('  Examples:');
                    console.log('    dolphin add adapter mongoose');
                    console.log('    dolphin add adapter sequelize');
                    console.log('    dolphin add adapter redis');
                }

            // add auth
            } else if (sub === 'auth') {
                writeFile(path.join(process.cwd(), 'controllers', 'auth.js'), TEMPLATES.auth, 'controllers/auth.js');
                writeFile(path.join(process.cwd(), 'models', 'User.js'), TEMPLATES.authModel, 'models/User.js');
                CLIUI.success('Auth controller + User model added!');
                console.log('\n  app.js मा थप्नुहोस्:');
                console.log('  import { auth } from \'./controllers/auth.js\';');
                console.log('  app.post(\'/api/auth/register\', auth.register);');
                console.log('  app.post(\'/api/auth/login\', auth.login);');

            // add crud
            } else if (sub === 'crud') {
                if (!name) return CLIUI.error('Usage: dolphin add crud <ModelName>');
                const N = capitalize(name);
                const plural = `${N.toLowerCase()}s`;

                // ── 1. Model file बनाउने ──────────────────────────────────────
                writeFile(path.join(process.cwd(), 'models', `${N}.js`), (TEMPLATES.crudModel as any)(N), `models/${N}.js`);

                // ── 2. app.js मा automatically inject गर्ने ──────────────────
                injectIntoAppJs(N, plural);

                // ── 3. adapters/db.js मा model register गर्ने ────────────────
                injectIntoDbAdapter(N);

                CLIUI.success(`CRUD for ${N} ready!`);
                console.log(`\n  🗺️  Routes:`);
                console.log(`    GET    /api/${plural}       → getAll`);
                console.log(`    GET    /api/${plural}/:id   → getOne`);
                console.log(`    POST   /api/${plural}       → create`);
                console.log(`    PUT    /api/${plural}/:id   → update`);
                console.log(`    DELETE /api/${plural}/:id   → delete`);
                console.log(`\n  ✅ app.js र adapters/db.js automatically update भयो!`);

            // add model
            } else if (sub === 'model') {
                if (!name) return CLIUI.error('Usage: dolphin add model <ModelName>');
                const N = capitalize(name);
                writeFile(path.join(process.cwd(), 'models', `${N}.js`), (TEMPLATES.model as any)(N), `models/${N}.js`);
                CLIUI.success(`${N} model added!`);

            // add middleware
            } else if (sub === 'middleware' || sub === 'mw') {
                if (!name) return CLIUI.error('Usage: dolphin add middleware <Name>');
                const N = capitalize(name);
                writeFile(path.join(process.cwd(), 'middleware', `${name.toLowerCase()}.js`), (TEMPLATES.middleware as any)(N), `middleware/${name.toLowerCase()}.js`);
                CLIUI.success(`${N} middleware added!`);
                console.log(`\n  app.use() मा थप्नुहोस्: import { ${name.toLowerCase()}Middleware } from './middleware/${name.toLowerCase()}.js';`);

            // add route
            } else if (sub === 'route' || sub === 'router') {
                if (!name) return CLIUI.error('Usage: dolphin add route <Name>');
                const N = capitalize(name);
                writeFile(path.join(process.cwd(), 'routes', `${name.toLowerCase()}.js`), (TEMPLATES.route as any)(N), `routes/${name.toLowerCase()}.js`);
                CLIUI.success(`${N} route added!`);
                console.log(`\n  import { ${name.toLowerCase()}Router } from './routes/${name.toLowerCase()}.js';`);
                console.log(`  app.use('', ${name.toLowerCase()}Router);`);

            // add service
            } else if (sub === 'service' || sub === 'svc') {
                if (!name) return CLIUI.error('Usage: dolphin add service <Name>');
                const N = capitalize(name);
                writeFile(path.join(process.cwd(), 'services', `${N}.service.js`), (TEMPLATES.service as any)(N), `services/${N}.service.js`);
                CLIUI.success(`${N}Service added!`);

            } else {
                CLIUI.error('Usage: dolphin add <subcommand>');
                console.log('\n  adapter <mongoose|sequelize|redis>   DB adapter');
                console.log('  auth                                 Auth system');
                console.log('  crud <ModelName>                     CRUD router + model (single-line app.js)');
                console.log('  model <ModelName>                    Mongoose model');
                console.log('  middleware <Name>                    Middleware');
                console.log('  route <Name>                         Route file');
                console.log('  service <Name>                       Service class');
            }
            break;
        }

        // ── status ───────────────────────────────────────────────────────────
        case 'status': {
            CLIUI.heading('Dolphin Project Status');
            const cwd = process.cwd();

            type CheckItem = { label: string; file?: string; alt?: string; dir?: string };
            const checks: CheckItem[] = [
                { label: 'package.json',    file: 'package.json' },
                { label: '.env',            file: '.env' },
                { label: 'app.js / app.ts', file: 'app.js', alt: 'app.ts' },
                { label: 'adapters/connection.js', file: 'adapters/connection.js', alt: 'adapters/connection.ts' },
                { label: 'adapters/db.js',  file: 'adapters/db.js', alt: 'adapters/db.ts' },
                { label: 'models/',         dir: 'models' },
                { label: 'controllers/',    dir: 'controllers' },
                { label: 'routes/',         dir: 'routes' },
                { label: 'middleware/',     dir: 'middleware' },
                { label: 'services/',       dir: 'services' },
            ];

            checks.forEach(({ label, file, alt, dir }) => {
                let exists = false;
                if (dir) exists = fs.existsSync(path.join(cwd, dir));
                else exists = fs.existsSync(path.join(cwd, file!)) || (alt ? fs.existsSync(path.join(cwd, alt)) : false);
                const icon = exists ? '\x1b[32m✔\x1b[0m' : '\x1b[33m–\x1b[0m';
                console.log(`  ${icon}  ${label}`);
            });

            const projPkg = path.join(cwd, 'package.json');
            if (fs.existsSync(projPkg)) {
                const p = JSON.parse(fs.readFileSync(projPkg, 'utf8'));
                const dsm = p.dependencies?.['dolphin-server-modules'] || p.devDependencies?.['dolphin-server-modules'];
                console.log(`\n  dolphin-server-modules: ${dsm || '(package.json मा छैन)'}`);
            }

            const dotEnv = path.join(cwd, '.env');
            if (fs.existsSync(dotEnv)) {
                const envText = fs.readFileSync(dotEnv, 'utf8');
                console.log('\n  .env keys:');
                ['MONGO_URI','JWT_SECRET','REDIS_URL','PORT'].forEach(k => {
                    const set = envText.includes(k + '=') && !envText.match(new RegExp(k + '=your_'));
                    console.log(`    ${set ? '\x1b[32m✔\x1b[0m' : '\x1b[33m–\x1b[0m'}  ${k}`);
                });
            }

            console.log(`\n  🐬 Dolphin CLI v${VERSION}`);
            break;
        }

        // ── deploy ───────────────────────────────────────────────────────────
        case 'deploy': {
            CLIUI.heading('Production Deployment (PM2)');
            const entry = fs.existsSync(path.join(process.cwd(), 'dist/index.js')) ? 'dist/index.js'
                        : fs.existsSync(path.join(process.cwd(), 'app.js')) ? 'app.js' : 'index.js';
            console.log(`
  \x1b[1mStep 1\x1b[0m — PM2 install:
  \x1b[36mnpm install -g pm2\x1b[0m

  \x1b[1mStep 2\x1b[0m — Build (TypeScript भए):
  \x1b[36mnpm run build\x1b[0m

  \x1b[1mStep 3\x1b[0m — Start:
  \x1b[36mpm2 start ${entry} --name "dolphin-app" --env production\x1b[0m

  \x1b[1mStep 4\x1b[0m — Auto-start on reboot:
  \x1b[36mpm2 startup && pm2 save\x1b[0m

  \x1b[1mStep 5\x1b[0m — Logs:
  \x1b[36mpm2 logs dolphin-app\x1b[0m

  ─── ecosystem.config.js (cluster mode) ────────────────
  module.exports = {
    apps: [{ name: 'dolphin-app', script: '${entry}',
      instances: 'max', exec_mode: 'cluster',
      env_production: { NODE_ENV: 'production', PORT: 3000 }
    }]
  };
  \x1b[36mpm2 start ecosystem.config.js --env production\x1b[0m
`);
            break;
        }

        // ── version ──────────────────────────────────────────────────────────
        case '-v':
        case '--version':
        case 'version':
            console.log(`🐬 Dolphin CLI v${VERSION}`);
            break;

        // ── help ─────────────────────────────────────────────────────────────
        case 'help':
        default:
            CLIUI.heading(`Dolphin Framework CLI  v${VERSION}`);
            console.log(`
\x1b[1mServer\x1b[0m
  serve [--port=N]             Dev server start गर्ने

\x1b[1mScaffolding\x1b[0m
  init / init-prod             Production project scaffold
  add adapter <type>           DB adapter  (mongoose|sequelize|redis)
  add auth                     Auth controller + User model
  add crud <ModelName>         CRUD router + Model  (single-line in app.js)
  add model <ModelName>        Mongoose model मात्र
  add middleware <Name>        Middleware file
  add route <Name>             Route file
  add service <Name>           Service class

\x1b[1mDatabase\x1b[0m
  connect mongoose [uri]       MongoDB connection test
  connect redis [uri]          Redis connection test

\x1b[1mAI  (API key चाहिन्छ)\x1b[0m
  generate <prompt>            Quick AI code generation
  generate-full <prompt>       Full project AI architecture
  chat                         Autonomous AI Agent (Cursor mode)

\x1b[1mProject\x1b[0m
  status                       Project health check
  deploy                       PM2 deployment guide

\x1b[1mInfo\x1b[0m
  -v / --version               Version
  help                         यो help
`);
    }
}

run().catch(err => {
    CLIUI.error(err.message);
    process.exit(1);
});