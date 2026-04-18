"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateAppRoute = exports.validatePagesRequest = exports.validateStructure = void 0;
const zod_1 = require("zod");
/**
 * Framework-agnostic validation utility.
 * Validates any given data against a provided Zod schema.
 */
const validateStructure = (schema, data) => {
    try {
        return schema.parse(data);
    }
    catch (err) {
        if (err instanceof zod_1.ZodError) {
            const zodErr = err;
            throw {
                status: 400,
                message: 'Validation Error',
                errors: zodErr.issues.map((e) => ({ field: e.path.join('.'), message: e.message }))
            };
        }
        throw err;
    }
};
exports.validateStructure = validateStructure;
/**
 * Express / Next.js Pages API Middleware
 * Validates request body, query, and params.
 */
const validatePagesRequest = (schemas) => {
    return (req, res, next) => {
        try {
            if (schemas.body)
                req.body = (0, exports.validateStructure)(schemas.body, req.body);
            if (schemas.query)
                req.query = (0, exports.validateStructure)(schemas.query, req.query);
            if (schemas.params)
                req.params = (0, exports.validateStructure)(schemas.params, req.params);
            next();
        }
        catch (err) {
            return res.status(err.status || 400).json(err);
        }
    };
};
exports.validatePagesRequest = validatePagesRequest;
/**
 * App Router Route Handler Wrapper
 * Used to wrap a standard Route Handler function to ensure request validation.
 */
const validateAppRoute = (schema, handler) => {
    return async (req, ...args) => {
        try {
            // Typically we validate the body for App Router POST/PUT requests
            let body;
            if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
                body = await req.json().catch(() => ({}));
            }
            else {
                const url = new URL(req.url);
                body = Object.fromEntries(url.searchParams.entries());
            }
            const validatedData = (0, exports.validateStructure)(schema, body);
            return handler(req, validatedData, ...args);
        }
        catch (err) {
            const status = err.status || 400;
            return new Response(JSON.stringify(err), {
                status,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    };
};
exports.validateAppRoute = validateAppRoute;
//# sourceMappingURL=zod.js.map