"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const zod_2 = require("./zod");
describe('Zod Validation Middleware', () => {
    const userSchema = zod_1.z.object({
        name: zod_1.z.string().min(2),
        age: zod_1.z.number().gte(18)
    });
    describe('validateStructure', () => {
        it('validates and returns data if valid', () => {
            const data = { name: 'Alice', age: 25 };
            const res = (0, zod_2.validateStructure)(userSchema, data);
            expect(res).toEqual(data);
        });
        it('throws custom error object if invalid', () => {
            expect(() => (0, zod_2.validateStructure)(userSchema, { name: 'A', age: 10 })).toThrowError();
            try {
                (0, zod_2.validateStructure)(userSchema, { name: 'A', age: 10 });
            }
            catch (err) {
                expect(err.status).toBe(400);
                expect(err.errors.length).toBe(2);
                expect(err.errors[0].field).toBe('name');
            }
        });
    });
    describe('validatePagesRequest', () => {
        it('calls next if valid', () => {
            const middleware = (0, zod_2.validatePagesRequest)({ body: userSchema });
            const req = { body: { name: 'Alice', age: 25 } };
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
            const next = jest.fn();
            middleware(req, res, next);
            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });
        it('returns 400 if invalid', () => {
            const middleware = (0, zod_2.validatePagesRequest)({ body: userSchema });
            const req = { body: { name: 'A' } };
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
            const next = jest.fn();
            middleware(req, res, next);
            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalled();
        });
    });
    describe('validateAppRoute', () => {
        it('passes validated data to the handler', async () => {
            const handler = jest.fn().mockReturnValue(new Response('OK'));
            const wrapped = (0, zod_2.validateAppRoute)(userSchema, handler);
            const request = new Request('http://localhost', {
                method: 'POST',
                body: JSON.stringify({ name: 'Alice', age: 25 })
            });
            const response = await wrapped(request);
            expect(handler).toHaveBeenCalledWith(request, { name: 'Alice', age: 25 });
        });
        it('returns a 400 response on validation failure', async () => {
            const handler = jest.fn();
            const wrapped = (0, zod_2.validateAppRoute)(userSchema, handler);
            const request = new Request('http://localhost', {
                method: 'POST',
                body: JSON.stringify({ name: 'A', age: 10 })
            });
            const response = await wrapped(request);
            expect(handler).not.toHaveBeenCalled();
            expect(response.status).toBe(400);
            const body = await response.json();
            expect(body.message).toBe('Validation Error');
            expect(body.errors.length).toBe(2);
        });
    });
});
//# sourceMappingURL=zod.test.js.map