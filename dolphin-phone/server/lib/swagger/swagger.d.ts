import { z } from "zod";
export declare function zodToJsonSchema(schema: any): any;
export interface SwaggerConfig {
    title: string;
    version: string;
    description?: string;
    servers?: {
        url: string;
        description?: string;
    }[];
    modules: {
        path: string;
        method: "get" | "post" | "put" | "delete" | "patch";
        summary?: string;
        description?: string;
        tags?: string[];
        schema?: z.ZodTypeAny;
        responseSchema?: z.ZodTypeAny;
        params?: Record<string, "string" | "number" | "boolean">;
        query?: Record<string, "string" | "number" | "boolean">;
    }[];
}
export declare function generateSwagger(config: SwaggerConfig): {
    openapi: string;
    info: {
        title: string;
        version: string;
        description: string;
    };
    servers: {
        url: string;
        description?: string;
    }[];
    paths: any;
};
export declare function serveSwaggerUI(swaggerJson: any, title?: string): string;
