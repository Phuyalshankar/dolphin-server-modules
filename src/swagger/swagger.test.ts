import { z } from "zod";
import { generateSwagger, zodToJsonSchema } from "./swagger";

describe("Dolphin Swagger", () => {
  it("should parse Zod string", () => {
    const s = z.string();
    expect(zodToJsonSchema(s)).toEqual({ type: "string" });
  });

  it("should parse Zod object", () => {
    const s = z.object({
      name: z.string(),
      age: z.number().optional()
    });
    const parsed = zodToJsonSchema(s);
    expect(parsed.type).toBe("object");
    expect(parsed.properties.name.type).toBe("string");
    expect(parsed.properties.age.type).toBe("number");
    expect(parsed.required).toEqual(["name"]);
  });

  it("should generate swagger JSON", () => {
    const userSchema = z.object({ email: z.string() });
    const docs = generateSwagger({
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
