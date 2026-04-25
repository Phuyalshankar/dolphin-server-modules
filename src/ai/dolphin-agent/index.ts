export * from './config.js';
export * from './agent.js';

import { DolphinAgent } from './agent.js';
import { defaultDolphinConfig, AIConfig } from './config.js';

export function initAgentHook(customConfig?: Partial<AIConfig>) {
    const config: AIConfig = { ...defaultDolphinConfig, ...customConfig };
    const agent = new DolphinAgent(config);
    
    if (config.autoGenerateEnv) {
        agent.generateEnv();
    }
    
    return agent;
}
