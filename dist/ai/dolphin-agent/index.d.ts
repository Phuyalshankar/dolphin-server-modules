export * from './config.js';
export * from './agent.js';
import { DolphinAgent } from './agent.js';
import { AIConfig } from './config.js';
export declare function initAgentHook(customConfig?: Partial<AIConfig>): DolphinAgent;
