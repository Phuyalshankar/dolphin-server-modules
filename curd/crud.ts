// crud.ts — Complete Working Version (All Tests Pass)

import crypto from 'node:crypto';

export interface DatabaseAdapter {
  createUser(data: any): Promise<any>;
  findUserByEmail(email: string): Promise<any>;
  findUserById(id: string): Promise<any>;
  updateUser(id: string, data: any): Promise<any>;
  saveRefreshToken(data: any): Promise<void>;
  findRefreshToken(token: string): Promise<any>;
  deleteRefreshToken(token: string): Promise<void>;
  create(collection: string, data: any): Promise<any>;
  read(collection: string, query: any): Promise<any[]>;
  update(collection: string, query: any, data: any): Promise<any>;
  delete(collection: string, query: any): Promise<any>;
  advancedRead?(collection: string, query: any, options: any): Promise<any[]>;
}

export interface BaseDocument {
  id: string;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  [key: string]: any;
}

// ===== HELPER: Fix ID for Mongoose =====
const fixId = (query: any): any => {
  if (!query) return query;
  if (query.id !== undefined) {
    query._id = query.id;
    delete query.id;
  }
  return query;
};

// ===== SAFE METHOD CALLS =====
const safeUpdate = async (db: DatabaseAdapter, collection: string, filter: any, data: any) => {
  const method = db.update || (db as any).updateOne;
  if (!method) throw new Error('No update method');
  return method.call(db, collection, fixId(filter), data);
};

const safeDelete = async (db: DatabaseAdapter, collection: string, filter: any) => {
  const method = db.delete || (db as any).deleteOne;
  if (!method) throw new Error('No delete method');
  return method.call(db, collection, fixId(filter));
};

// ===== MATCH FILTER (Type Safe) =====
const matchFilter = (item: any, filter: any): boolean => {
  for (const [key, val] of Object.entries(filter)) {
    if (key === '$and') {
      if (!Array.isArray(val) || !val.every((f: any) => matchFilter(item, f))) return false;
    } else if (key === '$or') {
      if (!Array.isArray(val) || !val.some((f: any) => matchFilter(item, f))) return false;
    } else {
      const itemVal = item[key];
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        const op = val as Record<string, any>;
        if (op.$eq !== undefined && itemVal !== op.$eq) return false;
        if (op.$ne !== undefined && itemVal === op.$ne) return false;
        if (op.$gt !== undefined && itemVal <= op.$gt) return false;
        if (op.$gte !== undefined && itemVal < op.$gte) return false;
        if (op.$lt !== undefined && itemVal >= op.$lt) return false;
        if (op.$lte !== undefined && itemVal > op.$lte) return false;
        if (op.$in !== undefined && !op.$in.includes(itemVal)) return false;
        if (op.$nin !== undefined && op.$nin.includes(itemVal)) return false;
        if (op.$like !== undefined && !String(itemVal).includes(String(op.$like))) return false;
      } else if (itemVal !== val) return false;
    }
  }
  return true;
};

export function createCRUD<T extends BaseDocument = BaseDocument>(
  db: DatabaseAdapter,
  options: { enforceOwnership?: boolean; softDelete?: boolean; defaultLimit?: number } = {}
) {
  const { enforceOwnership = true, softDelete = false, defaultLimit = 100 } = options;
  const generateId = () => crypto.randomBytes(12).toString('hex');

  const withOwnership = (filter: any, userId?: string): any => {
    if (enforceOwnership && !userId) return { _id: null };
    if (!enforceOwnership || !userId) return filter;
    return { ...filter, userId };
  };

  const filterDeleted = (items: T[]): T[] => {
    if (!softDelete) return items;
    return items.filter(i => !i.deletedAt);
  };

  const sortItems = (items: T[], sort?: { [key: string]: 'asc' | 'desc' }): T[] => {
    if (!sort) return items;
    const keys = Object.keys(sort);
    return [...items].sort((a, b) => {
      for (const k of keys) {
        const av = (a as any)[k];
        const bv = (b as any)[k];
        if (av === bv) continue;
        return sort[k] === 'asc' ? (av > bv ? 1 : -1) : (av > bv ? -1 : 1);
      }
      return 0;
    });
  };

  return {
    async create(collection: string, data: Partial<T>, userId?: string): Promise<T> {
      const now = new Date().toISOString();
      const doc = { id: generateId(), createdAt: now, updatedAt: now, ...(userId && { userId }), ...data } as T;
      return db.create(collection, doc);
    },

    async createMany(collection: string, items: Array<Partial<T>>, userId?: string): Promise<T[]> {
      const now = new Date().toISOString();
      const docs = items.map(item => ({ id: generateId(), createdAt: now, updatedAt: now, ...(userId && { userId }), ...item })) as T[];
      return Promise.all(docs.map(doc => db.create(collection, doc)));
    },

    async readOne(collection: string, id: string, userId?: string): Promise<T | null> {
      if (enforceOwnership && !userId) return null;
      let results = await db.read(collection, withOwnership({ id }, userId));
      if (results.length === 0) {
        results = await db.read(collection, withOwnership({ _id: id }, userId));
      }
      const filtered = filterDeleted(results);
      return filtered[0] || null;
    },

    async read(collection: string, filter: any = {}, options: any = {}, userId?: string): Promise<T[]> {
      if (enforceOwnership && !userId) return [];
      let items: T[] = [];
      const finalFilter = fixId(withOwnership(filter, userId));
      
      if (db.advancedRead) {
        items = await db.advancedRead(collection, finalFilter, options);
      } else {
        const raw = await db.read(collection, {});
        items = filterDeleted(raw).filter(i => matchFilter(i, finalFilter));
      }
      
      if (options.sort) items = sortItems(items, options.sort);
      if (options.offset || options.limit !== undefined) {
        const start = options.offset || 0;
        const end = start + (options.limit ?? items.length);
        items = items.slice(start, end);
      }
      return items;
    },

    async updateOne(collection: string, id: string, data: Partial<T>, userId?: string): Promise<T | null> {
      if (enforceOwnership && !userId) return null;
      let filter = withOwnership({ id }, userId);
      let results = await db.read(collection, filter);
      
      if (results.length === 0) {
        filter = withOwnership({ _id: id }, userId);
        results = await db.read(collection, filter);
      }
      
      if (results.length === 0) return null;
      const updateData = { ...data, updatedAt: new Date().toISOString() };
      await safeUpdate(db, collection, filter, updateData);
      return { ...results[0], ...updateData } as T;
    },

    async updateMany(collection: string, filter: any, data: Partial<T>, userId?: string): Promise<number> {
      if (enforceOwnership && !userId) return 0;
      const items = await this.read(collection, withOwnership(filter, userId), {}, userId);
      const updateData = { ...data, updatedAt: new Date().toISOString() };
      await Promise.all(items.map(item => safeUpdate(db, collection, { id: item.id }, updateData)));
      return items.length;
    },

    async deleteOne(collection: string, id: string, userId?: string): Promise<T | null> {
      if (enforceOwnership && !userId) return null;
      let filter = withOwnership({ id }, userId);
      let results = await db.read(collection, filter);
      
      if (results.length === 0) {
        filter = withOwnership({ _id: id }, userId);
        results = await db.read(collection, filter);
      }
      
      if (results.length === 0) return null;
      
      if (softDelete) {
        await db.update(collection, filter, { deletedAt: new Date().toISOString() });
        return results[0] as T;
      } else {
        await safeDelete(db, collection, filter);
        return results[0] as T;
      }
    },

    async deleteMany(collection: string, filter: any, userId?: string): Promise<number> {
      if (enforceOwnership && !userId) return 0;
      const items = await this.read(collection, withOwnership(filter, userId), {}, userId);
      
      if (softDelete) {
        await Promise.all(items.map(item => db.update(collection, { id: item.id }, { deletedAt: new Date().toISOString() })));
      } else {
        await safeDelete(db, collection, fixId(withOwnership(filter, userId)));
      }
      return items.length;
    },

    async restore(collection: string, id: string, userId?: string): Promise<T | null> {
      if (!softDelete) throw new Error('Soft delete not enabled');
      if (enforceOwnership && !userId) return null;
      
      // Search by id first
      let filter = withOwnership({ id, deletedAt: { $ne: null } }, userId);
      let results = await db.read(collection, filter);
      
      // Then try by _id
      if (results.length === 0) {
        filter = withOwnership({ _id: id, deletedAt: { $ne: null } }, userId);
        results = await db.read(collection, filter);
      }
      
      if (results.length === 0) return null;
      
      // Remove deletedAt field
      await db.update(collection, filter, { 
        deletedAt: null, 
        updatedAt: new Date().toISOString() 
      });
      
      // Return restored document
      return this.readOne(collection, id, userId);
    },

    async count(collection: string, filter: any = {}, userId?: string): Promise<number> {
      if (enforceOwnership && !userId) return 0;
      const raw = await db.read(collection, {});
      return filterDeleted(raw).filter(i => matchFilter(i, fixId(withOwnership(filter, userId)))).length;
    },

    async exists(collection: string, filter: any, userId?: string): Promise<boolean> {
      return (await this.count(collection, filter, userId)) > 0;
    },

    async paginate(collection: string, filter: any = {}, page: number = 1, limit: number = defaultLimit, userId?: string) {
      const offset = (page - 1) * limit;
      const items = await this.read(collection, filter, { limit, offset }, userId);
      const total = await this.count(collection, filter, userId);
      return { items, total, page, limit, totalPages: Math.ceil(total / limit), hasNext: page * limit < total, hasPrev: page > 1 };
    }
  };
}

export function createCrudController<T extends BaseDocument = BaseDocument>(
  adapter: any, 
  collection: string,
  options?: { enforceOwnership?: boolean; softDelete?: boolean; defaultLimit?: number }
) {
  const service = createCRUD<T>(adapter, options);
  return {
    getAll: async (ctx: any) => {
      const { limit, offset, ...filters } = ctx.query;
      const results = await service.read(collection, filters, { limit: limit ? parseInt(limit) : undefined, offset: offset ? parseInt(offset) : undefined }, ctx.req?.user?.id);
      ctx.json(results);
    },
    getOne: async (ctx: any) => {
      const result = await service.readOne(collection, ctx.params.id, ctx.req?.user?.id);
      if (!result) return ctx.status(404).json({ error: 'Not Found' });
      ctx.json(result);
    },
    create: async (ctx: any) => {
      const result = await service.create(collection, ctx.body, ctx.req?.user?.id);
      ctx.status(201).json(result);
    },
    update: async (ctx: any) => {
      const result = await service.updateOne(collection, ctx.params.id, ctx.body, ctx.req?.user?.id);
      if (!result) return ctx.status(404).json({ error: 'Not Found' });
      ctx.json(result);
    },
    delete: async (ctx: any) => {
      const result = await service.deleteOne(collection, ctx.params.id, ctx.req?.user?.id);
      if (!result) return ctx.status(404).json({ error: 'Not Found' });
      ctx.json({ success: true, deleted: result });
    }
  };
}