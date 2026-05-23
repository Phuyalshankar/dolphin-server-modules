import { AIService } from './src/services/ai-service.js';

async function test() {
    process.env.USE_OLLAMA = 'true';
    process.env.OLLAMA_MODEL = 'gemma3:latest';
    process.env.OLLAMA_BASE_URL = 'http://localhost:11434/v1';
    
    const ai = new AIService({ apiKey: 'test' });
    console.log("Checking Ollama connectivity (Non-streaming)...");
    try {
        const response = await ai.request("Hi, who are you?");
        console.log("Ollama Response:", response);
    } catch (e: any) {
        console.error("Ollama Request Failed:", e.message);
    }
}

test();
