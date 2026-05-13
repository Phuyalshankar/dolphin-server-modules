export interface AIConfig {
    framework: 'dolphin' | 'express' | 'nextjs' | 'react' | string;
    generateOnlyServerCode?: boolean;
    autoGenerateEnv?: boolean;
    provider?: 'gemini' | 'openai' | 'groq';
    apiKey?: string;
}
export declare const defaultDolphinConfig: AIConfig;
export declare function getFrameworkPrompt(config: AIConfig): string;
