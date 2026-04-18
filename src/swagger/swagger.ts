import { z } from "zod";

export function zodToJsonSchema(schema: any): any {
  if (!schema || !schema._def) return { type: "string" };
  
  const typeName = schema._def.typeName || schema._def.type;
  
  // Convert standard Zod names or Zod Lite names
  const normalizedType = typeof typeName === 'string' ? typeName.replace('Zod', '').toLowerCase() : '';
  
  if (normalizedType === "string") {
    return { type: "string" };
  } else if (normalizedType === "number") {
    return { type: "number" };
  } else if (normalizedType === "boolean") {
    return { type: "boolean" };
  } else if (normalizedType === "array") {
    return {
      type: "array",
      items: zodToJsonSchema(schema._def.type || schema._def.element)
    };
  } else if (normalizedType === "object") {
    const rawShape = schema._def.shape;
    const shape = typeof rawShape === "function" ? rawShape() : rawShape;
    const properties: Record<string, any> = {};
    const required: string[] = [];
    
    for (const [key, propSchema] of Object.entries(shape || {})) {
      const propDef = (propSchema as any)._def;
      
      let innerSchema = propSchema;
      let isRequired = true;
      
      const propType = propDef?.typeName || propDef?.type;
      const normPropType = typeof propType === 'string' ? propType.replace('Zod', '').toLowerCase() : '';
      
      if (normPropType === "optional" || normPropType === "nullable") {
        isRequired = false;
        innerSchema = propDef.innerType;
      }
      
      properties[key] = zodToJsonSchema(innerSchema);
      if (isRequired) required.push(key);
    }
    
    const schemaObj: any = { type: "object", properties };
    if (required.length > 0) schemaObj.required = required;
    return schemaObj;
  } else if (normalizedType === "optional" || normalizedType === "nullable") {
      return zodToJsonSchema(schema._def.innerType);
  } else if (normalizedType === "enum") {
      return { type: "string", enum: schema._def.values || schema._def.entries };
  }
  
  return { type: "string" }; // default fallback
}

export interface SwaggerConfig {
  title: string;
  version: string;
  description?: string;
  servers?: { url: string; description?: string }[];
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

export function generateSwagger(config: SwaggerConfig) {
  const paths: any = {};
  
  for (const mod of config.modules) {
    if (!paths[mod.path]) paths[mod.path] = {};
    
    const operation: any = {
      summary: mod.summary || `Endpoint for ${mod.path}`,
      description: mod.description,
      tags: mod.tags || ["API"],
      responses: {
        "200": {
          description: "Successful response"
        }
      }
    };
    
    const parameters: any[] = [];
    if (mod.params) {
      for (const [k, v] of Object.entries(mod.params)) {
        parameters.push({ name: k, in: "path", required: true, schema: { type: v } });
      }
    }
    if (mod.query) {
      for (const [k, v] of Object.entries(mod.query)) {
        parameters.push({ name: k, in: "query", required: false, schema: { type: v } });
      }
    }
    if (parameters.length > 0) {
      operation.parameters = parameters;
    }
    
    if (mod.schema && ['post', 'put', 'patch'].includes(mod.method.toLowerCase())) {
      operation.requestBody = {
        required: true,
        content: {
          "application/json": {
            schema: zodToJsonSchema(mod.schema)
          }
        }
      };
    }
    
    if (mod.responseSchema) {
      operation.responses["200"].content = {
        "application/json": {
          schema: zodToJsonSchema(mod.responseSchema)
        }
      };
    }
    
    paths[mod.path][mod.method.toLowerCase()] = operation;
  }
  
  return {
    openapi: "3.0.0",
    info: {
      title: config.title,
      version: config.version,
      description: config.description || "Auto-generated API Docs",
    },
    servers: config.servers || [{ url: "/" }],
    paths
  };
}

export function serveSwaggerUI(swaggerJson: any, title = 'API Documentation') {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@4/swagger-ui.css" />
    <style>
        body { margin: 0; padding: 0; }
        .swagger-ui .topbar { display: none; } 
    </style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@4/swagger-ui-bundle.js"></script>
    <script>
        window.onload = () => {
            window.ui = SwaggerUIBundle({
                spec: ${JSON.stringify(swaggerJson)},
                dom_id: '#swagger-ui',
                deepLinking: true,
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIBundle.SwaggerUIStandalonePreset
                ],
                layout: "BaseLayout"
            });
        };
    </script>
</body>
</html>
  `.trim();
}
