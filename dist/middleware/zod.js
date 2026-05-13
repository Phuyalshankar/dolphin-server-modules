import { ZodError } from 'zod';
/**
 * Framework-agnostic validation utility.
 * Validates any given data against a provided Zod schema.
 */
export const validateStructure = (schema, data) => {
    try {
        return schema.parse(data);
    }
    catch (err) {
        if (err instanceof ZodError) {
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
/**
 * Express / Next.js Pages API Middleware
 * Validates request body, query, and params.
 */
export const validatePagesRequest = (schemas) => {
    return (req, res, next) => {
        try {
            if (schemas.body)
                req.body = validateStructure(schemas.body, req.body);
            if (schemas.query)
                req.query = validateStructure(schemas.query, req.query);
            if (schemas.params)
                req.params = validateStructure(schemas.params, req.params);
            next();
        }
        catch (err) {
            return res.status(err.status || 400).json(err);
        }
    };
};
/**
 * App Router Route Handler Wrapper
 * Used to wrap a standard Route Handler function to ensure request validation.
 */
export const validateAppRoute = (schema, handler) => {
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
            const validatedData = validateStructure(schema, body);
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
//# sourceMappingURL=zod.js.map