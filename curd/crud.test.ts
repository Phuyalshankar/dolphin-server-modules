import { createCRUD, DatabaseAdapter, BaseDocument, QueryFilter, PaginationOptions } from './crud';

class MockDB implements DatabaseAdapter {
  private data: Record<string, BaseDocument[]> = {};

  async createUser() { return {}; }
  async findUserByEmail() { return {}; }
  async findUserById() { return {}; }
  async updateUser() { return {}; }
  async saveRefreshToken() {}
  async findRefreshToken() {}
  async deleteRefreshToken() {}

  async create(collection: string, doc: any) {
    if (!this.data[collection]) this.data[collection] = [];
    this.data[collection].push(doc);
    return doc;
  }

  async read(collection: string, query: any) {
    return this.data[collection] || [];
  }

  async update(collection: string, query: any, data: any) {
    if (!this.data[collection]) return null;
    const docIndex = this.data[collection].findIndex(d => d.id === query.id);
    if (docIndex === -1 && query.id) return null;
    
    // For many
    for (let i = 0; i < this.data[collection].length; i++) {
      if (!query.id || this.data[collection][i].id === query.id) {
        this.data[collection][i] = { ...this.data[collection][i], ...data };
      }
    }
    return data;
  }

  async delete(collection: string, query: any) {
    if (!this.data[collection]) return null;
    // Just simple mock for id match or flush
    if (query.id) {
       this.data[collection] = this.data[collection].filter(d => d.id !== query.id?.['$eq'] && d.id !== query.id);
    } else {
       this.data[collection] = [];
    }
    return true;
  }
}

describe('CRUD Factory', () => {
  let db: MockDB;
  
  beforeEach(() => {
    db = new MockDB();
  });

  it('creates and reads documents with softdelete enabled', async () => {
    const crud = createCRUD(db, { softDelete: true, enforceOwnership: false });
    const user = 'user_1';
    
    const doc1 = await crud.create('posts', { title: 'Hello', rating: 5 }, user);
    expect(doc1.title).toBe('Hello');
    expect(doc1.userId).toBe(user);

    const doc2 = await crud.create('posts', { title: 'World', rating: 4 }, user);
    
    let list = await crud.read('posts');
    expect(list.length).toBe(2);

    // Delete one
    await crud.deleteOne('posts', doc1.id);
    list = await crud.read('posts');
    expect(list.length).toBe(1); // One is soft deleted

    // Restore
    await crud.restore('posts', doc1.id);
    list = await crud.read('posts');
    expect(list.length).toBe(2); // Restored
  });

  it('applies complex filters correctly', async () => {
    const crud = createCRUD(db, { enforceOwnership: false });
    
    await crud.createMany('items', [
       { category: 'A', price: 10 },
       { category: 'A', price: 20 },
       { category: 'B', price: 15 },
       { category: 'B', price: 5 }
    ]);

    const res1 = await crud.read('items', { category: { $in: ['A'] } });
    expect(res1.length).toBe(2);

    const res2 = await crud.read('items', { price: { $gt: 10 } });
    expect(res2.length).toBe(2);

    const res3 = await crud.read('items', { 
       $or: [
           { price: { $lte: 5 } },
           { category: 'A' }
       ] 
    });
    expect(res3.length).toBe(3); // A items + price<=5
  });

  it('supports pagination and sorting', async () => {
    const crud = createCRUD(db, { enforceOwnership: false });
    
    await crud.createMany('scores', [
       { p: 10 }, { p: 50 }, { p: 20 }, { p: 30 }
    ]);

    const page1 = await crud.paginate('scores', {}, 1, 2);
    expect(page1.items.length).toBe(2);
    expect(page1.total).toBe(4);
    expect(page1.totalPages).toBe(2);
    expect(page1.hasNext).toBe(true);

    const sorted = await crud.read('scores', {}, { sort: { p: 'desc' } });
    expect(sorted[0].p).toBe(50);
    expect(sorted[3].p).toBe(10);
  });
});
