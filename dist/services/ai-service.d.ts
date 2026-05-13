export interface AIServiceConfig {
    apiKey: string;
    baseUrl?: string;
    model?: string;
}
export declare class AIService {
    private config;
    private providers;
    private currentProviderIdx;
    private currentModelIdx;
    history: {
        role: string;
        content: string;
    }[];
    constructor(config: AIServiceConfig);
    clearHistory(): void;
    private initializeProviders;
    request(prompt: string, systemPrompt?: string): Promise<string>;
    requestStream(prompt: string, systemPrompt: string | undefined, onChunk: (chunk: string) => void): Promise<string>;
    private retryLoop;
    private executeRequest;
}
