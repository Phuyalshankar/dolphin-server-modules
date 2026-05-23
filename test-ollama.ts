import { AIService } from './src/services/ai-service.js';

async function test() {
    process.env.USE_OLLAMA = 'true';
    process.env.OLLAMA_MODEL = 'llama3';
    
    const ai = new AIService({ apiKey: 'test' });
    console.log("Checking Ollama connectivity...");
    try {
        const response = await ai.request("Hi, are you Ollama?");
        console.log("Ollama Response:", response);
    } catch (e: any) {
        console.error("Ollama Connection Failed:", e.message);
    }
}

test();
