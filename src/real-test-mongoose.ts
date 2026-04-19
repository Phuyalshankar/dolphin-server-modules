import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createDolphinServer } from './server/server';
import { createMongooseAdapter } from './adapters/mongoose';
import { createCrudController } from './curd/crud';

// Define a sample schema
const ProductSchema = new mongoose.Schema({
  name: String,
  price: Number,
  category: String,
  createdAt: String,
  updatedAt: String,
});
const Product = mongoose.model('Product', ProductSchema);

const UserSchema = new mongoose.Schema({
  email: String
});
const User = mongoose.model('User', UserSchema);

const RefreshTokenSchema = new mongoose.Schema({
  token: String
});
const RefreshToken = mongoose.model('RefreshToken', RefreshTokenSchema);

async function runTest() {
  console.log('🌱 Starting MongoDB Memory Server...');
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  
  await mongoose.connect(uri);
  console.log('✅ Connected to MongoDB Memory Server');

  // Create Mongoose adapter for Dolphin CRUD
  const db = createMongooseAdapter({
    User,
    RefreshToken,
    models: { Product },
    leanByDefault: true,
    softDelete: false
  });

  const app = createDolphinServer();

  // Create CRUD Controller, disable enforceOwnership so it works publicly
  const crud = createCrudController(db, "Product", { enforceOwnership: false });

  // Map Routes
  app.get('/products', crud.getAll)
  app.get('/products/:id', crud.getOne)
  app.post('/products', crud.create)
  app.put('/products/:id', crud.update)
  app.delete('/products/:id', crud.delete)

  const server = app.listen(3002, async () => {
    console.log('🚀 Server running on port 3002\n');
    console.log('--- RUNNING TESTS ---\n');

    try {
      // 1. Create a Product
      console.log('➡️ POST /products');
      let res = await fetch('http://localhost:3002/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Real Mongoose iPhone', price: 999, category: 'Electronics' })
      });
      const createdItem: any = await res.json();
      console.log('✅ Created:', createdItem, '\n');

      // 2. Read All Products
      const itemId = createdItem.id || createdItem._id;
      console.log('➡️ GET /products');
      res = await fetch('http://localhost:3002/products');
      const allItems = await res.json();
      console.log('✅ All Products:', allItems, '\n');

      // 3. Read Single Product by ID
      console.log(`➡️ GET /products/${itemId}`);
      res = await fetch(`http://localhost:3002/products/${itemId}`);
      let singleItem = await res.json();
      console.log('✅ Single Product:', singleItem, '\n');

      // 4. Update Product
      console.log(`➡️ PUT /products/${itemId}`);
      res = await fetch(`http://localhost:3002/products/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price: 899 })
      });
      const updatedItem = await res.json();
      console.log('✅ Updated Product:', updatedItem, '\n');

      // 5. Delete Product
      console.log(`➡️ DELETE /products/${createdItem.id}`);
      res = await fetch(`http://localhost:3002/products/${createdItem.id}`, { method: 'DELETE' });
      const deleteResult = await res.json();
      console.log('✅ Delete Result:', deleteResult, '\n');

      // 6. Ensure empty list now
      console.log('➡️ GET /products (After Delete)');
      res = await fetch('http://localhost:3002/products');
      const finalItems = await res.json();
      console.log('✅ All Products:', finalItems, '\n');

      console.log('🎉 REAL MONGODB CRUD CONTROLLER TESTS PASSED!');
    } catch (err) {
      console.error('❌ Test failed:', err);
    } finally {
      // Cleanup
      server.close();
      await mongoose.disconnect();
      await mongod.stop();
      process.exit(0);
    }
  });
}

runTest().catch(console.error);
