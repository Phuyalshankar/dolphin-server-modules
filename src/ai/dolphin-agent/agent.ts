import { promises as fs, existsSync } from 'fs';
import path from 'path';
import * as readline from 'readline/promises';
import { AIService } from '../../services/ai-service.js';
import { CLIUI } from '../../utils/ui.js';
import { AIConfig, getFrameworkPrompt } from './config.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import crypto from 'crypto';

const execAsync = promisify(exec);

interface FileIndex {
    path: string;
    hash: string;
    content: string;
}

export class DolphinAgent {
    private ai: AIService;
    private config: AIConfig;
    private currentDir: string;
    private rl: readline.Interface;
    private projectIndex: Map<string, FileIndex> = new Map();
    private symbolIndex: Map<string, { file: string, line: number, type: string }[]> = new Map();
    private keywordIndex: Map<string, Set<string>> = new Map();

    constructor(config: AIConfig) {
        this.config = config;
        this.currentDir = process.cwd();
        this.rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        
        const apiKey = config.apiKey || process.env.DOLPHIN_AI_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || '';
        
        this.ai = new AIService({
            apiKey: apiKey,
            model: process.env.DOLPHIN_AI_MODEL
        });
    }

    private calculateHash(content: string): string {
        return crypto.createHash('md5').update(content).digest('hex');
    }

    private async walkDir(dir: string, fileList: string[] = []) {
        const files = await fs.readdir(dir);
        for (const file of files) {
            const filePath = path.join(dir, file);
            if (filePath.includes('node_modules') || filePath.includes('.git') || filePath.includes('dist') || filePath.includes('build')) continue;
            
            const stat = await fs.stat(filePath);
            if (stat.isDirectory()) {
                await this.walkDir(filePath, fileList);
            } else if (/\.(js|ts|jsx|tsx|json)$/.test(file)) {
                fileList.push(filePath);
            }
        }
        return fileList;
    }

    private updateSemanticIndex(filePath: string, content: string) {
        // Simple keyword indexing
        const tokens = content.toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length > 3);
        tokens.forEach(token => {
            if (!this.keywordIndex.has(token)) this.keywordIndex.set(token, new Set());
            this.keywordIndex.get(token)!.add(filePath);
        });

        // Basic symbol tracking (regex based for speed)
        const funcRegex = /(?:function\s+([a-zA-Z0-9_]+))|(?:const\s+([a-zA-Z0-9_]+)\s*=\s*(?:\([^)]*\)|[a-zA-Z0-9_]+)\s*=>)|(?:class\s+([a-zA-Z0-9_]+))/g;
        let match;
        const lines = content.split('\n');
        
        while ((match = funcRegex.exec(content)) !== null) {
            const name = match[1] || match[2] || match[3];
            if (name) {
                const lineNo = content.substring(0, match.index).split('\n').length;
                const type = match[1] ? 'function' : match[2] ? 'arrow' : 'class';
                
                if (!this.symbolIndex.has(name)) this.symbolIndex.set(name, []);
                this.symbolIndex.get(name)!.push({ file: filePath, line: lineNo, type });
            }
        }
    }

    private semanticSearch(query: string): string[] {
        const queryTokens = query.toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length > 3);
        const scores = new Map<string, number>();

        queryTokens.forEach(token => {
            if (this.keywordIndex.has(token)) {
                this.keywordIndex.get(token)!.forEach(file => {
                    scores.set(file, (scores.get(file) || 0) + 1);
                });
            }
        });

        return Array.from(scores.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(e => e[0]);
    }

    public async buildProjectMemory() {
        CLIUI.startSpinner(`🧠 प्रोजेक्ट बुझ्दै (Indexing files)...`);
        try {
            const files = await this.walkDir(this.currentDir);
            for (const file of files) {
                const content = await fs.readFile(file, 'utf8');
                const hash = this.calculateHash(content);
                
                if (!this.projectIndex.has(file) || this.projectIndex.get(file)?.hash !== hash) {
                    this.projectIndex.set(file, { path: file, hash, content });
                    this.updateSemanticIndex(file, content);
                }
            }
            CLIUI.stopSpinner(true, `✅ Project Index vayo (${this.projectIndex.size} files, ${this.symbolIndex.size} symbols).`);
        } catch (error: any) {
            CLIUI.stopSpinner(false, `❌ प्रोजेक्ट इन्डेक्स गर्न असफल: ${error.message}`);
        }
    }

    public async generateEnv() {
        const envPath = path.join(process.cwd(), '.env');
        if (!existsSync(envPath)) {
            let envContent = '';
            
            if (this.config.framework === 'dolphin') {
                envContent = `PORT=3000\nMONGO_URI=mongodb://localhost:27017/dolphin_agent_db\nJWT_SECRET=super_secret_dolphin_key_999\nDOLPHIN_AI_KEY=your_api_key_here\n`;
            } else if (this.config.framework === 'express') {
                envContent = `PORT=8000\nDATABASE_URL=\nAPI_KEY=\n`;
            } else if (this.config.framework === 'nextjs') {
                envContent = `NEXT_PUBLIC_API_URL=http://localhost:3000/api\nDATABASE_URL=\nNEXT_PUBLIC_AI_KEY=\n`;
            } else {
                envContent = `PORT=3000\nAPI_KEY=\n`;
            }

            await fs.writeFile(envPath, envContent);
            CLIUI.success(`[Dolphin-Agent] .env generated successfully for ${this.config.framework}`);
        }
    }

    private async askPermission(question: string): Promise<boolean> {
        const answer = await this.rl.question(`\n\x1b[33m⚠️ ${question} (y/n):\x1b[0m `);
        return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
    }

    private isCommandSafe(cmd: string): boolean {
        const dangerousPatterns = [/rm -rf \//, /mkfs/, /dd if=/, /:(){:|:&};:/];
        for (const pattern of dangerousPatterns) {
            if (pattern.test(cmd)) return false;
        }
        return true;
    }

    private isSensitiveFile(filePath: string): boolean {
        const name = path.basename(filePath).toLowerCase();
        return name === '.env' || name.includes('secret') || name.includes('password') || name.includes('key');
    }

    private parseAIResponse(response: string): any[] {
        const toolCalls: any[] = [];
        const jsonBlocks = response.match(/\{[\s\S]*?\}/g) || [];
        
        for (const block of jsonBlocks) {
            try {
                const cleanBlock = block.replace(/```json|```/g, '').trim();
                let parsed = JSON.parse(cleanBlock);
                if (parsed.tool) toolCalls.push(this.normalizeToolCall(parsed));
            } catch (e) {}
        }
        return toolCalls.filter(t => t && t.tool);
    }

    private normalizeToolCall(parsed: any) {
        if (parsed.params && typeof parsed.params === 'object') {
            return { ...parsed, ...parsed.params };
        }
        return parsed;
    }

    private buildContextPrompt(userInput: string): string {
        let context = "\n\n--- PROJECT CONTEXT ---\n";
        
        // Semantic search for relevant files
        const relevantFiles = this.semanticSearch(userInput);
        if (relevantFiles.length > 0) {
            context += "Relevant Files for this task:\n";
            relevantFiles.forEach(file => {
                const content = this.projectIndex.get(file)?.content || '';
                context += `\nFILE: ${path.relative(this.currentDir, file)}\nCONTENT:\n${content.substring(0, 1000)}${content.length > 1000 ? '...' : ''}\n`;
            });
        }

        const fileNames = Array.from(this.projectIndex.keys()).map(p => path.relative(this.currentDir, p));
        context += `\nFull Project Structure: \n${fileNames.join('\n')}\n`;
        
        return context;
    }

    public async interactiveChat() {
        CLIUI.heading(`🐬 Dolphin Autonomous Agent (${this.config.framework.toUpperCase()} Mode)`);
        
        await this.buildProjectMemory();

        while (true) {
            let input = '';
            try {
                input = await this.rl.question('\n💬 You: ');
            } catch (e: any) {
                if (e.code === 'ABORT_ERR') {
                    console.log('\n👋 Bye!');
                    this.rl.close();
                    break;
                }
                throw e;
            }

            if (input.toLowerCase() === 'exit') {
                this.rl.close();
                break;
            }

            let currentPrompt = input;
            let isRunning = true;
            let retryCount = 0;
            const MAX_RETRIES = 3;

            while (isRunning && retryCount < MAX_RETRIES) {
                process.stdout.write(`\r🤖 AI: `);
                try {
                    let systemPrompt = getFrameworkPrompt(this.config) + this.buildContextPrompt(input);
                    let response = '';
                    
                    response = await this.ai.requestStream(currentPrompt, systemPrompt, (chunk) => {
                        process.stdout.write(chunk);
                    });

                    console.log('\n');

                    const toolCalls = this.parseAIResponse(response);

                    if (toolCalls.length > 0) {
                        let results = '';

                        for (const toolCall of toolCalls) {
                            try {
                                switch (toolCall.tool) {
                                    case 'read':
                                        const rPath = path.resolve(this.currentDir, toolCall.path);
                                        if (this.isSensitiveFile(rPath)) {
                                            console.log(`\n\x1b[33m⚠️ Warning: Agent le ${toolCall.path} padhna khojdai chha.\x1b[0m`);
                                        }
                                        console.log(`📁 File kholirahechh: ${toolCall.path}`);
                                        if (existsSync(rPath)) {
                                            const content = await fs.readFile(rPath, 'utf8');
                                            results += `Content of ${toolCall.path}:\n${content}\n\n`;
                                        } else {
                                            results += `Error: ${toolCall.path} not found.\n`;
                                        }
                                        break;

                                    case 'write':
                                        const wPath = path.resolve(this.currentDir, toolCall.path);
                                        console.log(`\n\x1b[36m🔧 Code lekhdai/update gardai: ${toolCall.path}\x1b[0m`);
                                        if (await this.askPermission(`Ke tapai yo file lekhna/update garna permission dinu hunchha?`)) {
                                            await fs.mkdir(path.dirname(wPath), { recursive: true });
                                            await fs.writeFile(wPath, toolCall.content);
                                            console.log(`📝 Wrote to ${toolCall.path}`);
                                            results += `File ${toolCall.path} written successfully.\n`;
                                            this.updateSemanticIndex(wPath, toolCall.content);
                                        } else {
                                            console.log(`🚫 Action denied.`);
                                            results += `User denied permission to write ${toolCall.path}.\n`;
                                        }
                                        break;

                                    case 'delete':
                                        const dPath = path.resolve(this.currentDir, toolCall.path);
                                        console.log(`\n\x1b[31m⚠️ मेट्दै: ${toolCall.path}\x1b[0m`);
                                        if (await this.askPermission(`Ke tapai yo file/folder delete garna permission dinu hunchha?`)) {
                                            if (existsSync(dPath)) {
                                                await fs.rm(dPath, { recursive: true, force: true });
                                                console.log(`🗑️ Deleted ${toolCall.path}`);
                                                results += `Deleted ${toolCall.path} successfully.\n`;
                                                this.projectIndex.delete(dPath);
                                            } else {
                                                results += `Error: ${toolCall.path} not found.\n`;
                                            }
                                        } else {
                                            console.log(`🚫 Action denied.`);
                                            results += `User denied permission to delete ${toolCall.path}.\n`;
                                        }
                                        break;

                                    case 'list':
                                        const lPath = path.resolve(this.currentDir, toolCall.path || '.');
                                        if (existsSync(lPath)) {
                                            const files = await fs.readdir(lPath);
                                            console.log(`📁 Files in ${toolCall.path || '.'}: ${files.join(', ')}`);
                                            results += `Files in ${toolCall.path || '.'}:\n${files.join('\n')}\n`;
                                        } else {
                                            results += `Error: Directory ${toolCall.path} not found.\n`;
                                        }
                                        break;

                                    case 'shell':
                                        console.log(`\n\x1b[36m💻 Run gardai: ${toolCall.cmd}\x1b[0m`);
                                        if (!this.isCommandSafe(toolCall.cmd)) {
                                            console.log(`\x1b[31m⚠️ Khataranak Command: ${toolCall.cmd}\x1b[0m`);
                                            results += `Error: Command rejected.\n`;
                                            break;
                                        }
                                        if (await this.askPermission(`Ke tapai yo command chalauna permission dinu hunchha?`)) {
                                            try {
                                                const { stdout, stderr } = await execAsync(toolCall.cmd, { cwd: this.currentDir });
                                                console.log(`✅ Command safal!`);
                                                results += `Shell Output:\n${stdout}\n${stderr}\n`;
                                            } catch (err: any) {
                                                console.log(`❌ Shell Error: ${err.message}`);
                                                results += `Shell Error:\n${err.message}\nFix this error.`;
                                            }
                                        } else {
                                            console.log(`🚫 Action denied.`);
                                            results += `User denied permission to run ${toolCall.cmd}.\n`;
                                        }
                                        break;

                                    case 'patch':
                                        const patchPath = path.resolve(this.currentDir, toolCall.path);
                                        console.log(`\n\x1b[36m🩹 Patch gardai: ${toolCall.path}\x1b[0m`);
                                        if (await this.askPermission(`Ke tapai yo patch lagauna permission dinu hunchha?`)) {
                                            if (existsSync(patchPath)) {
                                                let content = await fs.readFile(patchPath, 'utf8');
                                                const newContent = content.replace(toolCall.old, toolCall.new);
                                                if (content === newContent) {
                                                    results += `Warning: Target text not found in ${toolCall.path}. Patch failed.\n`;
                                                } else {
                                                    await fs.writeFile(patchPath, newContent);
                                                    console.log(`✅ Patch applied to ${toolCall.path}`);
                                                    results += `File ${toolCall.path} patched successfully.\n`;
                                                    this.updateSemanticIndex(patchPath, newContent);
                                                }
                                            }
                                        }
                                        break;

                                    case 'search_symbol':
                                        console.log(`\n\x1b[36m🔍 Symbol khojdai: ${toolCall.name}\x1b[0m`);
                                        const symbols = this.symbolIndex.get(toolCall.name);
                                        if (symbols) {
                                            results += `Symbol "${toolCall.name}" found in:\n`;
                                            symbols.forEach(s => {
                                                results += `- File: ${path.relative(this.currentDir, s.file)}, Line: ${s.line}, Type: ${s.type}\n`;
                                            });
                                        } else {
                                            results += `Symbol "${toolCall.name}" not found in project index.\n`;
                                        }
                                        break;

                                    case 'done':
                                        console.log(`\n✅ Kaam sakiyo.`);
                                        isRunning = false;
                                        break;
                                }
                            } catch (toolError: any) {
                                console.log(`\x1b[31m[Agent Error] Tool ${toolCall.tool} failed: ${toolError.message}\x1b[0m`);
                                results += `Tool Error: ${toolError.message}\n`;
                            }
                        }

                        if (results && isRunning) {
                            currentPrompt = `Results of actions:\n${results}\n\nWhat next?`;
                            retryCount++;
                            if (retryCount >= MAX_RETRIES) isRunning = false;
                            continue;
                        }
                    } else {
                        isRunning = false;
                    }
                } catch (e: any) {
                    console.log(`\n❌ API Error: ${e.message}`);
                    isRunning = false;
                }
            }
        }
    }

    public async executeTask(prompt: string) {
        return this.interactiveChat();
    }
}
