import { createDolphinServer } from "../server/server.ts";
import { createCrudController } from "../curd/crud.ts";

// Mock Database Connection
const dbConnect = async () => {
  console.log("🛠️ Mock Database connected successfully!");
};

// Mock Database Implementation
const db = {
  read: async () => [{ id: "1", name: "Laptop", price: 1000 }],
  create: async (data) => ({ id: Math.random().toString(36).substr(2, 9), ...data }),
  update: async (id, data) => ({ id, ...data }),
  delete: async (id) => ({ id, message: "Deleted successfully" }),
  findById: async (id) => ({ id, name: "Sample Product", price: 500 })
};

const app = createDolphinServer();

/**
 * नोट: यदि तपाईँको फोल्डरको नाम 'crud' हो भने 
 * 'import ... from "../crud/crud.ts"' प्रयोग गर्नुहोस्।
 * यहाँ context अनुसार '../curd/crud.ts' राखिएको छ।
 */
const crud = createCrudController(db, "Product");

await dbConnect();

// CORRECT ROUTE MAPPINGS:
app.get('/products', crud.getAll)        // GET all products
app.get('/products/:id', crud.getOne)    // GET single product by ID
app.post('/products', crud.create)       // POST create product
app.put('/products/:id', crud.update)    // PUT update product by ID
app.delete('/products/:id', crud.delete) // DELETE product by ID

app.listen(3000, () => {
  console.log(`
  🚀 Server running on port 3000
  
  📋 Available Routes:
  GET    /products          - Get all products
  GET    /products/:id      - Get single product
  POST   /products          - Create new product
  PUT    /products/:id      - Update product
  DELETE /products/:id      - Delete product
  `);
});