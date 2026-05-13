export * from './config.js';
export * from './agent.js';
import { DolphinAgent } from './agent.js';
import { defaultDolphinConfig } from './config.js';
export function initAgentHook(customConfig) {
    const config = { ...defaultDolphinConfig, ...customConfig };
    const agent = new DolphinAgent(config);
    if (config.autoGenerateEnv) {
        agent.generateEnv();
    }
    return agent;
}
//# sourceMappingURL=index.js.map