"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const swagger_1 = require("./swagger");
describe("Dolphin Swagger", () => {
    it("should parse Zod string", () => {
        const s = zod_1.z.string();
        expect((0, swagger_1.zodToJsonSchema)(s)).toEqual({ type: "string" });
    });
    it("should parse Zod object", () => {
        const s = zod_1.z.object({
            name: zod_1.z.string(),
            age: zod_1.z.number().optional()
        });
        const parsed = (0, swagger_1.zodToJsonSchema)(s);
        expect(parsed.type).toBe("object");
        expect(parsed.properties.name.type).toBe("string");
        expect(parsed.properties.age.type).toBe("number");
        expect(parsed.required).toEqual(["name"]);
    });
    it("should generate swagger JSON", () => {
        const userSchema = zod_1.z.object({ email: zod_1.z.string() });
        const docs = (0, swagger_1.generateSwagger)({
            title: "Test API",
            version: "1.0.0",
            modules: [
                {
                    path: "/users",
                    method: "post",
                    schema: userSchema,
                    description: "Create user"
                }
            ]
        });
        expect(docs.openapi).toBe("3.0.0");
        expect(docs.info.title).toBe("Test API");
        expect(docs.paths["/users"]["post"].requestBody.content["application/json"].schema.type).toBe("object");
    });
});
//# sourceMappingURL=swagger.test.js.map