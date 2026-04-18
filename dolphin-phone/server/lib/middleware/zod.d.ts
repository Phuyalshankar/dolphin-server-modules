import { z } from 'zod';
/**
 * Framework-agnostic validation utility.
 * Validates any given data against a provided Zod schema.
 */
export declare const validateStructure: <T>(schema: z.ZodSchema<T>, data: unknown) => T;
/**
 * Express / Next.js Pages API Middleware
 * Validates request body, query, and params.
 */
export declare const validatePagesRequest: (schemas: {
    body?: z.ZodSchema<any>;
    query?: z.ZodSchema<any>;
    params?: z.ZodSchema<any>;
}) => (req: any, res: any, next: Function) => any;
/**
 * App Router Route Handler Wrapper
 * Used to wrap a standard Route Handler function to ensure request validation.
 */
export declare const validateAppRoute: (schema: z.ZodSchema<any>, handler: (req: Request, validatedData: any, ...args: any[]) => Promise<Response> | Response) => (req: Request, ...args: any[]) => Promise<Response>;
