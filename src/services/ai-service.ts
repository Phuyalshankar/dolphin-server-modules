import https from 'https';
import http from 'http';
import { URL } from 'url';

export interface AIServiceConfig {
    apiKey: string;
    baseUrl?: string;
    model?: string;
}

export class AIService {
    private providers: any[] = [];
    private currentProviderIdx = 0;
    private currentModelIdx = 0;
    public history: { role: string, content: string }[] = [];

    constructor(private config: AIServiceConfig) {
        this.initializeProviders();
    }

    public clearHistory() {
        this.history = [];
    }

    private initializeProviders() {
        // 1. Google Gemini (Primary or Custom if baseUrl is set)
        this.providers.push({
            name: 'Google Gemini',
            baseUrl: this.config.baseUrl || 'https://generativelanguage.googleapis.com',
            apiKey: this.config.apiKey,
            models: this.config.model ? [this.config.model] : ['gemini-2.0-flash-exp', 'gemini-1.5-pro'],
            isCustom: !!this.config.baseUrl
        });

        // 2. Ollama (Local)
        if (process.env.OLLAMA_BASE_URL || process.env.USE_OLLAMA === 'true') {
            this.providers.push({
                name: 'Ollama (Local)',
                baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
                apiKey: 'ollama', 
                models: [process.env.OLLAMA_MODEL || 'llama3', 'mistral', 'codellama'],
                isCustom: true
            });
        }

        // 3. Groq Fallback
        if (process.env.GROQ_API_KEY) {
            this.providers.push({
                name: 'Groq Cloud',
                baseUrl: 'https://api.groq.com/openai/v1',
                apiKey: process.env.GROQ_API_KEY,
                models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
                isCustom: true
            });
        }

        // 4. OpenAI Fallback
        if (process.env.OPENAI_API_KEY) {
            this.providers.push({
                name: 'OpenAI',
                baseUrl: 'https://api.openai.com/v1',
                apiKey: process.env.OPENAI_API_KEY,
                models: ['gpt-4o-mini', 'gpt-4o'],
                isCustom: true
            });
        }
    }

    async request(prompt: string, systemPrompt?: string): Promise<string> {
        this.currentProviderIdx = 0;
        this.currentModelIdx = 0;
        
        // Add user message to history
        this.history.push({ role: 'user', content: prompt });
        
        const response = await this.retryLoop(prompt, systemPrompt);
        
        // Add AI response to history
        this.history.push({ role: 'assistant', content: response });
        return response;
    }

    async requestStream(prompt: string, systemPrompt: string | undefined, onChunk: (chunk: string) => void): Promise<string> {
        this.history.push({ role: 'user', content: prompt });

        // Find first available provider with a key
        let providerIdx = 0;
        while (providerIdx < this.providers.length) {
            const p = this.providers[providerIdx];
            if (p.apiKey || p.name.includes('Ollama')) break;
            providerIdx++;
        }

        const provider = this.providers[providerIdx];
        if (!provider) throw new Error('No valid AI provider found.');

        const model = provider.models[0]; // Use first model for streaming

        const url = new URL(provider.baseUrl);
        const isCustom = provider.isCustom;
        const protocol = url.protocol === 'https:' ? https : http;
        
        const apiPath = isCustom 
            ? (url.pathname.endsWith('/') ? url.pathname + 'chat/completions' : url.pathname + '/chat/completions')
            : `/v1/models/${model}:streamGenerateContent?key=${encodeURIComponent(provider.apiKey)}`;

        const data = isCustom ? JSON.stringify({
            model: model,
            messages: [
                ...(systemPrompt ? [{ role: 'system', content: `${systemPrompt}\nCurrent Date: ${new Date().toISOString()}` }] : []),
                ...this.history
            ],
            temperature: 0.1,
            stream: true
        }) : JSON.stringify({
            contents: this.history.map(h => ({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.content }] })),
            system_instruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined
        });

        const options = {
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: apiPath.replace('//', '/'),
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(isCustom ? { 'Authorization': `Bearer ${provider.apiKey}` } : {})
            }
        };

        let fullResponse = '';
        let streamBuffer = '';

        return new Promise((resolve, reject) => {
            const req = protocol.request(options, (res) => {
                res.on('data', (chunk) => {
                    streamBuffer += chunk.toString();
                    
                    if (isCustom) {
                        const lines = streamBuffer.split('\n');
                        // Keep the last incomplete line in the buffer
                        streamBuffer = lines.pop() || '';

                        for (const line of lines) {
                            const trimmed = line.trim();
                            if (!trimmed.startsWith('data: ')) continue;
                            
                            const raw = trimmed.replace('data: ', '').trim();
                            if (raw === '[DONE]') continue;
                            
                            try {
                                const json = JSON.parse(raw);
                                const content = json.choices?.[0]?.delta?.content || '';
                                if (content) {
                                    fullResponse += content;
                                    onChunk(content);
                                }
                            } catch (e) {
                                // If it's a partial JSON, we might need to put it back, 
                                // but with 'data: ' prefix it should be a full line.
                            }
                        }
                    } else {
                        // Gemini Stream handling (simplified)
                        try {
                            const json = JSON.parse(streamBuffer);
                            const content = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
                            if (content) {
                                fullResponse += content;
                                onChunk(content);
                                streamBuffer = ''; // Clear after successful parse
                            }
                        } catch (e) {
                            // Wait for more data
                        }
                    }
                });

                res.on('end', () => {
                    this.history.push({ role: 'assistant', content: fullResponse });
                    resolve(fullResponse);
                });
            });

            req.on('error', reject);
            req.write(data);
            req.end();
        });
    }

    private async retryLoop(prompt: string, systemPrompt: string | undefined): Promise<string> {
        const provider = this.providers[this.currentProviderIdx];
        
        if (!provider) {
            throw new Error('All AI providers (Gemini, Ollama, Groq, OpenAI) failed or keys are missing.');
        }

        if (!provider.apiKey) {
            this.currentProviderIdx++;
            return this.retryLoop(prompt, systemPrompt);
        }

        const model = provider.models[this.currentModelIdx];
        
        if (!model) {
            this.currentProviderIdx++;
            this.currentModelIdx = 0;
            return this.retryLoop(prompt, systemPrompt);
        }

        try {
            return await this.executeRequest(prompt, systemPrompt, provider, model);
        } catch (error: any) {
            console.log(`⚠️ ${provider.name} Failed (${model}): ${error.message || 'Unknown Error'}`);
            
            if (error.message?.includes('429') || error.message?.toLowerCase().includes('quota')) {
                const attempt = this.currentModelIdx + 1;
                const backoff = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
                await new Promise(r => setTimeout(r, backoff));
            }
            
            if (this.currentModelIdx >= provider.models.length - 1) {
                this.currentProviderIdx++;
                this.currentModelIdx = 0;
                return this.retryLoop(prompt, systemPrompt);
            }

            this.currentModelIdx++;
            return this.retryLoop(prompt, systemPrompt);
        }
    }

    private executeRequest(prompt: string, systemPrompt: string | undefined, provider: any, model: string): Promise<string> {
        const url = new URL(provider.baseUrl);
        const isCustom = provider.isCustom;
        const protocol = url.protocol === 'https:' ? https : http;
        
        const apiPath = isCustom 
            ? (url.pathname.endsWith('/') ? url.pathname + 'chat/completions' : url.pathname + '/chat/completions')
            : `/v1/models/${model}:generateContent?key=${encodeURIComponent(provider.apiKey)}`;

        const data = isCustom ? JSON.stringify({
            model: model,
            messages: [
                ...(systemPrompt ? [{ role: 'system', content: `${systemPrompt}\nCurrent Date: ${new Date().toISOString()}` }] : []),
                ...this.history
            ],
            temperature: 0.1
        }) : JSON.stringify({
            contents: this.history.map(h => ({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.content }] })),
            system_instruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined
        });

        const options = {
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: apiPath.replace('//', '/'),
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(isCustom ? { 'Authorization': `Bearer ${provider.apiKey}` } : {})
            }
        };

        return new Promise((resolve, reject) => {
            const req = protocol.request(options, (res) => {
                let body = '';
                res.on('data', (d) => body += d);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(body);
                        if (res.statusCode && res.statusCode >= 400) {
                            return reject(new Error(`API Error ${res.statusCode}: ${json.error?.message || json.error || body}`));
                        }

                        let result = '';
                        if (isCustom) {
                            result = json.choices?.[0]?.message?.content || '';
                        } else {
                            result = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
                        }

                        if (!result) return reject(new Error('Empty AI response'));
                        resolve(result);
                    } catch (e) {
                        reject(new Error('Failed to parse AI response'));
                    }
                });
            });

            req.on('error', reject);
            req.write(data);
            req.end();
        });
    }
}
