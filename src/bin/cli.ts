#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { createServer } from 'http';
import { AIService } from '../services/ai-service.js';
import { CLIUI } from '../utils/ui.js';
import { TEMPLATES } from '../templates/index.js';

const args = process.argv.slice(2);
const command = args[0] || 'help';

// Simple .env loader
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
            process.env[key.trim()] = valueParts.join('=').trim();
        }
    });
}

const aiConfig = {
    apiKey: (process.env.DOLPHIN_AI_KEY || process.env.GEMINI_API_KEY || '').trim(),
    baseUrl: process.env.DOLPHIN_AI_BASE_URL,
    model: process.env.DOLPHIN_AI_MODEL
};

const useOllama = process.env.USE_OLLAMA === 'true';

const hasAnyKey = aiConfig.apiKey || process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;

if (!hasAnyKey && !useOllama && ['generate', 'generate-full', 'chat'].includes(command)) {
    CLIUI.error('API Key not found! Please set DOLPHIN_AI_KEY, GEMINI_API_KEY, or GROQ_API_KEY in your .env file.');
    process.exit(1);
}

const ai = new AIService(aiConfig);

async function run() {
    switch (command) {
        case 'serve':
            const port = parseInt(args.find(arg => arg.startsWith('--port='))?.split('=')[1] || '3000');
            CLIUI.heading(`Dolphin Dev Server starting on port ${port}`);
            const server = createServer((req, res) => {
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end('Dolphin Server is swimming!\n');
            });
            server.listen(port, () => {
                CLIUI.success(`Server is live at http://localhost:${port}`);
            });
            break;

        case 'generate':
            const prompt = args.slice(1).join(' ');
            if (!prompt) return CLIUI.error('Usage: dolphin generate "your prompt"');
            
            CLIUI.startSpinner('AI is generating code');
            try {
                const response = await ai.request(prompt, "Return ONLY raw JavaScript code. No markdown.");
                const cleanCode = response.replace(/```javascript|```js|```/g, '').trim();
                fs.writeFileSync(path.join(process.cwd(), 'ai-generated.js'), cleanCode);
                CLIUI.stopSpinner(true, 'File generated: ai-generated.js');
            } catch (e: any) {
                CLIUI.stopSpinner(false, e.message);
            }
            break;

        case 'generate-full':
            const fullPrompt = args.slice(1).join(' ');
            if (!fullPrompt) return CLIUI.error('Usage: dolphin generate-full "project description"');

            CLIUI.startSpinner('Architecting full project structure');
            try {
                const systemPrompt = `You are a Dolphin Framework expert. Generate a production-ready backend project using ONLY Dolphin Server modules.
Dolphin Components:
- Use 'dolphin-server-modules/server' for createDolphinServer()
- Use 'dolphin-server-modules/adapters/mongoose' for createMongooseAdapter()
- Use 'dolphin-server-modules/auth-controller' for createDolphinAuthController()
- Use 'dolphin-server-modules/crud' for createCrudController()
- Models: Mongoose schemas only
- Controllers: Use Dolphin CRUD controllers
- Main app: Use createDolphinServer(), not Express
- DB: Use createMongooseAdapter() for MongoDB
- Auth: Use createDolphinAuthController()
- Routes: Direct on app, no separate route files
- index.js: Main entry point using Dolphin server
Project Structure:
- index.js (main server)
- models/ (Mongoose models)
- controllers/ (Dolphin controllers)
- config/db.js (DB connection)
- .env (env vars)
Return ONLY a JSON object where keys are file paths and values are code content. No markdown.`;
                const response = await ai.request(fullPrompt, systemPrompt);
                
                // Extract only the part between { and } to avoid AI's conversational chatter
                const jsonMatch = response.match(/\{[\s\S]*\}/);
                const cleaned = jsonMatch ? jsonMatch[0] : response.replace(/```json|```/g, '').trim();
                
                let files;
                try {
                    files = JSON.parse(cleaned);
                } catch (err) {
                    // AI le pathayeko "raw newlines" ra illegal control characters lai escape garne
                    const sanitized = cleaned.replace(/[\x00-\x1F\x7F-\x9F]/g, (c) => 
                        c === '\n' ? '\\n' : (c === '\r' ? '\\r' : (c === '\t' ? '\\t' : ''))
                    );
                    files = JSON.parse(sanitized);
                }
                
                Object.entries(files).forEach(([fPath, content]) => {
                    const fullPath = path.join(process.cwd(), fPath as string);

                    // Don't overwrite existing .env files to protect API keys
                    if (fPath === '.env' && fs.existsSync(fullPath)) {
                        console.log(`  ⚠️ Skipped: .env (file already exists)`);
                        return;
                    }

                    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
                    fs.writeFileSync(fullPath, content as string);
                    console.log(`  📄 Created: ${fPath}`);
                });

                // Ensure .env file exists with defaults
                const envPath = path.join(process.cwd(), '.env');
                if (!fs.existsSync(envPath)) {
                    const defaultEnv = `MONGO_URI=mongodb://localhost:27017/dolphin_db
JWT_SECRET=your_ultra_secret_jwt_key_here
GEMINI_API_KEY=your_gemini_api_key_here
GROQ_API_KEY=your_groq_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
`;
                    fs.writeFileSync(envPath, defaultEnv);
                    console.log(`  📄 Created: .env (with defaults)`);
                }
                CLIUI.stopSpinner(true, 'Project architected successfully!');
            } catch (e: any) {
                CLIUI.stopSpinner(false, e.message);
            }
            break;

        case 'chat':
            import('../ai/dolphin-agent/index.js').then(agentModule => {
                const agent = agentModule.initAgentHook({ framework: 'dolphin', autoGenerateEnv: false });
                agent.interactiveChat();
            }).catch(err => {
                CLIUI.error(`[Dolphin-Agent] Failed to start chat: ${err.message}`);
            });
            break;

        case 'init':
        case 'init-prod':
            CLIUI.heading('Scaffolding Production Project');
            const dirs = ['models', 'controllers', 'routes', 'middleware', 'services', 'config'];
            dirs.forEach(dir => {
                const p = path.join(process.cwd(), dir);
                if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
            });
            fs.writeFileSync(path.join(process.cwd(), 'app.js'), TEMPLATES.app);
            CLIUI.success('Folders and app.js created.');
            
            import('../ai/dolphin-agent/index.js').then(agentModule => {
                agentModule.initAgentHook({ framework: 'dolphin', autoGenerateEnv: true });
            }).catch(err => {
                CLIUI.error(`[Dolphin-Agent] Initialization failed: ${err.message}`);
            });
            break;

        case 'add':
            const subCommand = args[1];
            if (subCommand === 'adapter') {
                const type = args[2];
                if (type === 'mongoose') {
                    const configDir = path.join(process.cwd(), 'config');
                    if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
                    fs.writeFileSync(path.join(configDir, 'db.js'), TEMPLATES.mongoose);
                    CLIUI.success('Mongoose adapter added to config/db.js');
                } else {
                    CLIUI.error('Unsupported adapter. Try: dolphin add adapter mongoose');
                }
            } else if (subCommand === 'auth') {
                const controllerDir = path.join(process.cwd(), 'controllers');
                const modelDir = path.join(process.cwd(), 'models');
                if (!fs.existsSync(controllerDir)) fs.mkdirSync(controllerDir, { recursive: true });
                if (!fs.existsSync(modelDir)) fs.mkdirSync(modelDir, { recursive: true });
                
                fs.writeFileSync(path.join(controllerDir, 'auth.js'), TEMPLATES.auth);
                fs.writeFileSync(path.join(modelDir, 'User.js'), TEMPLATES.authModel);
                CLIUI.success('Auth controller and User model added.');
            } else if (subCommand === 'crud') {
                const name = args[2];
                if (!name) return CLIUI.error('Usage: dolphin add crud <ModelName>');
                
                const controllerDir = path.join(process.cwd(), 'controllers');
                const modelDir = path.join(process.cwd(), 'models');
                
                if (!fs.existsSync(controllerDir)) fs.mkdirSync(controllerDir, { recursive: true });
                if (!fs.existsSync(modelDir)) fs.mkdirSync(modelDir, { recursive: true });
                
                fs.writeFileSync(path.join(controllerDir, `${name.toLowerCase()}.js`), (TEMPLATES.crud as any)(name));
                fs.writeFileSync(path.join(modelDir, `${name}.js`), (TEMPLATES.crudModel as any)(name));
                
                CLIUI.success(`CRUD Controller and Model for ${name} generated successfully!`);
                console.log(`  📄 Created: controllers/${name.toLowerCase()}.js`);
                console.log(`  📄 Created: models/${name}.js`);
            } else {
                CLIUI.error('Usage: dolphin add <adapter|auth|crud>');
            }
            break;

        case '-v':
        case '--version':
            console.log(`🐬 Dolphin CLI v2.9.3`);
            break;

        case 'help':
        default:
            CLIUI.heading('Dolphin Framework CLI');
            console.log(`
Commands:
  serve              Start development server
  generate <prompt>  Quick AI code generation
  generate-full <p>  Full project architecture
  chat               Autonomous AI Agent Mode (Full Access)
  init-prod          Scaffold production folder structure
  add adapter <t>    Add Mongoose/Sequelize adapter
  add auth           Add pre-built Auth controller
  add crud <Name>    Add CRUD controller for a model
  -v, --version      Show CLI version
            `);
            break;
    }
}

run().catch(err => {
    CLIUI.error(err.message);
});
