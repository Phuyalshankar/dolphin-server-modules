// curd/crud.test.ts
import { createCRUD } from './crud';

// Simple in-memory adapter for testing
class TestAdapter {
  private data: Record<string, any[]> = {};

  async create(collection: string, doc: any) {
    if (!this.data[collection]) this.data[collection] = [];
    this.data[collection].push(doc);
    return doc;
  }

  async read(collection: string, query: any) {
    const items = this.data[collection] || [];
    if (!query || Object.keys(query).length === 0) return items;
    
    return items.filter((item: any) => {
      for (const [key, val] of Object.entries(query)) {
        if (key === 'id' && item.id !== val) return false;
        if (key === '_id' && item.id !== val) return false;
        if (item[key] !== val) return false;
      }
      return true;
    });
  }

  async update(collection: string, query: any, data: any) {
    const items = this.data[collection] || [];
    for (let i = 0; i < items.length; i++) {
      if (query.id && items[i].id === query.id) {
        this.data[collection][i] = { ...items[i], ...data };
        return this.data[collection][i];
      }
      if (query._id && items[i].id === query._id) {
        this.data[collection][i] = { ...items[i], ...data };
        return this.data[collection][i];
      }
    }
    return null;
  }

  async delete(collection: string, query: any) {
    if (!this.data[collection]) return null;
    
    if (query.id) {
      this.data[collection] = this.data[collection].filter((d: any) => d.id !== query.id);
      return { deleted: true };
    }
    
    if (query._id) {
      this.data[collection] = this.data[collection].filter((d: any) => d.id !== query._id);
      return { deleted: true };
    }
    
    if (Object.keys(query).length === 0) {
      this.data[collection] = [];
      return { deleted: true };
    }
    
    return null;
  }

  // Required methods for DatabaseAdapter interface
  async createUser() { return {}; }
  async findUserByEmail() { return null; }
  async findUserById() { return null; }
  async updateUser() { return {}; }
  async saveRefreshToken() {}
  async findRefreshToken() { return null; }
  async deleteRefreshToken() {}
}

describe('CRUD Tests', () => {
  let crud: any;
  let db: TestAdapter;

  beforeEach(() => {
    db = new TestAdapter();
    crud = createCRUD(db, { softDelete: false, enforceOwnership: false });
  });

  it('should create item', async () => {
    const item = await crud.create('products', { name: 'Test', price: 100 });
    expect(item.id).toBeDefined();
    expect(item.name).toBe('Test');
  });

  it('should read items', async () => {
    await crud.create('products', { name: 'Product 1' });
    await crud.create('products', { name: 'Product 2' });
    
    const items = await crud.read('products');
    expect(items).toHaveLength(2);
  });

  it('should update item', async () => {
    const created = await crud.create('products', { name: 'Old' });
    const updated = await crud.updateOne('products', created.id, { name: 'New' });
    
    expect(updated?.name).toBe('New');
  });

  it('should delete item', async () => {
    const created = await crud.create('products', { name: 'Delete Me' });
    await crud.deleteOne('products', created.id);
    
    const items = await crud.read('products');
    expect(items).toHaveLength(0);
  });

  it('should read one item by id', async () => {
    const created = await crud.create('products', { name: 'Find Me' });
    const found = await crud.readOne('products', created.id);
    
    expect(found).toBeDefined();
    expect(found.name).toBe('Find Me');
  });
});