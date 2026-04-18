/**
 * Real Mongoose Integration Tests
 * mongodb-memory-server प्रयोग गरेर real MongoDB engine सँग test
 */

import mongoose, { Schema, Model } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createMongooseAdapter } from './index';
import { createCRUD } from '../../curd/crud';

// ===== Schemas =====
const ProductSchema = new Schema({
  id:        String,
  name:      { type: String, required: true },
  price:     Number,
  category:  String,
  stock:     Number,
  userId:    String,
  createdAt: String,
  updatedAt: String,
  deletedAt: { type: String, default: null },
}, { timestamps: false });

const UserSchema       = new Schema({ email: String, password: String });
const RefreshTokenSchema = new Schema({ token: String, userId: String });

let mongod: MongoMemoryServer;
let Product: Model<any>;
let User: Model<any>;
let RefreshToken: Model<any>;
let adapter: any;
let crud: ReturnType<typeof createCRUD>;

// ===== Setup / Teardown =====
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  Product      = mongoose.model('IProduct', ProductSchema);
  User         = mongoose.model('IUser', UserSchema);
  RefreshToken = mongoose.model('IRefreshToken', RefreshTokenSchema);

  adapter = createMongooseAdapter({
    User,
    RefreshToken,
    models: { Product },
    leanByDefault: true,
    softDelete: false,
  });

  crud = createCRUD(adapter, { enforceOwnership: false });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await Product.deleteMany({});
});

// ===================================================================
// 1. ADAPTER LEVEL TESTS
// ===================================================================
describe('Mongoose Adapter — Direct', () => {

  test('create() — document DB मा save हुन्छ', async () => {
    const doc = await adapter.create('Product', {
      id: 'p1', name: 'Laptop', price: 1200, category: 'Electronics',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    expect(doc.name).toBe('Laptop');
    expect(doc.price).toBe(1200);
    expect(doc._id).toBeUndefined();   // _id hidden हुन्छ
    expect(doc.id).toBeDefined();      // id exposed हुन्छ
  });

  test('read() — सबै documents ल्याउँछ', async () => {
    await adapter.create('Product', { id: 'p1', name: 'A', price: 100, createdAt: '', updatedAt: '' });
    await adapter.create('Product', { id: 'p2', name: 'B', price: 200, createdAt: '', updatedAt: '' });
    const docs = await adapter.read('Product', {});
    expect(docs).toHaveLength(2);
  });

  test('read() — id बाट filter गर्छ', async () => {
    const created = await adapter.create('Product', { id: 'p1', name: 'Mouse', price: 25, createdAt: '', updatedAt: '' });
    await adapter.create('Product', { id: 'p2', name: 'Keyboard', price: 75, createdAt: '', updatedAt: '' });

    const results = await adapter.read('Product', { id: created.id });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Mouse');
  });

  test('read() — $like query काम गर्छ', async () => {
    await adapter.create('Product', { id: 'p1', name: 'Laptop Pro', price: 1500, createdAt: '', updatedAt: '' });
    await adapter.create('Product', { id: 'p2', name: 'Laptop Air', price: 1200, createdAt: '', updatedAt: '' });
    await adapter.create('Product', { id: 'p3', name: 'Mouse', price: 25, createdAt: '', updatedAt: '' });

    const results = await adapter.read('Product', { name: { $like: 'Laptop' } });
    expect(results).toHaveLength(2);
    expect(results.every((r: any) => r.name.includes('Laptop'))).toBe(true);
  });

  test('readOne() — ID बाट सही document ल्याउँछ', async () => {
    const created = await adapter.create('Product', { id: 'p1', name: 'Headphones', price: 300, createdAt: '', updatedAt: '' });
    const result = await adapter.readOne('Product', created.id);
    expect(result).not.toBeNull();
    expect(result.name).toBe('Headphones');
  });

  test('readOne() — नभएको ID मा null फर्काउँछ', async () => {
    const result = await adapter.readOne('Product', new mongoose.Types.ObjectId().toString());
    expect(result).toBeNull();
  });

  test('updateOne() — field update हुन्छ', async () => {
    const created = await adapter.create('Product', { id: 'p1', name: 'Phone', price: 800, createdAt: '', updatedAt: '' });
    const updated = await adapter.updateOne('Product', created.id, { price: 750 });
    expect(updated.price).toBe(750);
    expect(updated.name).toBe('Phone');       // अरू fields unchanged
    expect(updated.updatedAt).toBeDefined();
  });

  test('deleteOne() — document मेटिन्छ', async () => {
    const created = await adapter.create('Product', { id: 'p1', name: 'Tablet', price: 600, createdAt: '', updatedAt: '' });
    await adapter.deleteOne('Product', created.id);
    const result = await adapter.readOne('Product', created.id);
    expect(result).toBeNull();
  });

  test('advancedRead() — sort काम गर्छ', async () => {
    await adapter.create('Product', { id: 'p1', name: 'C', price: 300, createdAt: '', updatedAt: '' });
    await adapter.create('Product', { id: 'p2', name: 'A', price: 100, createdAt: '', updatedAt: '' });
    await adapter.create('Product', { id: 'p3', name: 'B', price: 200, createdAt: '', updatedAt: '' });

    const results = await adapter.advancedRead('Product', {}, { sort: { price: 'asc' } });
    expect(results[0].price).toBe(100);
    expect(results[2].price).toBe(300);
  });

  test('advancedRead() — limit र offset काम गर्छ', async () => {
    for (let i = 1; i <= 5; i++) {
      await adapter.create('Product', { id: `p${i}`, name: `P${i}`, price: i * 100, createdAt: '', updatedAt: '' });
    }
    const results = await adapter.advancedRead('Product', {}, { limit: 2, offset: 1 });
    expect(results).toHaveLength(2);
  });

  test('count() — सही count दिन्छ', async () => {
    await adapter.create('Product', { id: 'p1', name: 'A', price: 100, createdAt: '', updatedAt: '' });
    await adapter.create('Product', { id: 'p2', name: 'B', price: 200, createdAt: '', updatedAt: '' });
    const count = await adapter.count('Product');
    expect(count).toBe(2);
  });

  test('paginate() — page र totalPages सही छ', async () => {
    for (let i = 1; i <= 7; i++) {
      await adapter.create('Product', { id: `p${i}`, name: `P${i}`, price: i * 10, createdAt: '', updatedAt: '' });
    }
    const page = await adapter.paginate('Product', {}, 2, 3);
    expect(page.items).toHaveLength(3);
    expect(page.total).toBe(7);
    expect(page.totalPages).toBe(3);
    expect(page.hasNext).toBe(true);
    expect(page.hasPrev).toBe(true);
  });
});

// ===================================================================
// 2. CRUD SERVICE (enforceOwnership: false) — Route-level tests
// ===================================================================
describe('createCRUD + Mongoose — Route Simulation', () => {

  test('create → getAll — POST, GET all', async () => {
    await crud.create('Product', { name: 'Laptop', price: 1200 });
    await crud.create('Product', { name: 'Mouse', price: 25 });
    const all = await crud.read('Product');
    expect(all).toHaveLength(2);
  });

  test('create → readOne — POST, GET :id', async () => {
    const created = await crud.create('Product', { name: 'Monitor', price: 400 });
    const found = await crud.readOne('Product', created.id);
    expect(found).not.toBeNull();
    expect(found!.name).toBe('Monitor');
  });

  test('create → updateOne — POST, PUT :id', async () => {
    const created = await crud.create('Product', { name: 'Keyboard', price: 80 });
    const updated = await crud.updateOne('Product', created.id, { price: 65 });
    expect(updated!.price).toBe(65);
    expect(updated!.name).toBe('Keyboard');
  });

  test('create → deleteOne — POST, DELETE :id', async () => {
    const created = await crud.create('Product', { name: 'Speaker', price: 150 });
    await crud.deleteOne('Product', created.id);
    const found = await crud.readOne('Product', created.id);
    expect(found).toBeNull();
  });

  test('readOne — नभएको ID → null', async () => {
    const result = await crud.readOne('Product', new mongoose.Types.ObjectId().toString());
    expect(result).toBeNull();
  });

  test('updateOne — नभएको ID → null', async () => {
    const result = await crud.updateOne('Product', new mongoose.Types.ObjectId().toString(), { price: 999 });
    expect(result).toBeNull();
  });

  test('deleteOne — नभएको ID → null', async () => {
    const result = await crud.deleteOne('Product', new mongoose.Types.ObjectId().toString());
    expect(result).toBeNull();
  });

  test('read with filter — category ले filter हुन्छ', async () => {
    await crud.create('Product', { name: 'Laptop', price: 1200, category: 'Electronics' });
    await crud.create('Product', { name: 'Chair', price: 200, category: 'Furniture' });
    await crud.create('Product', { name: 'Phone', price: 800, category: 'Electronics' });

    const electronics = await crud.read('Product', { category: 'Electronics' });
    expect(electronics).toHaveLength(2);
    expect(electronics.every(p => p.category === 'Electronics')).toBe(true);
  });

  test('paginate — correct pagination', async () => {
    for (let i = 1; i <= 10; i++) {
      await crud.create('Product', { name: `P${i}`, price: i * 100 });
    }
    const page = await crud.paginate('Product', {}, 1, 3);
    expect(page.items).toHaveLength(3);
    expect(page.total).toBe(10);
    expect(page.totalPages).toBe(4);
  });

  test('exists() — document भएको confirm गर्छ', async () => {
    await crud.create('Product', { name: 'Watch', price: 500, category: 'Accessories' });
    const yes = await crud.exists('Product', { category: 'Accessories' });
    const no  = await crud.exists('Product', { category: 'NonExistent' });
    expect(yes).toBe(true);
    expect(no).toBe(false);
  });

  test('createMany — multiple documents एकै पटक', async () => {
    await crud.createMany('Product', [
      { name: 'A', price: 10 },
      { name: 'B', price: 20 },
      { name: 'C', price: 30 },
    ]);
    const count = await crud.count('Product');
    expect(count).toBe(3);
  });
});
