// crud-lite.ts — World-class lightweight CRUD (2026 style, full-featured)
// Compatible with your auth DatabaseAdapter

import crypto from 'node:crypto';

// ===== DATABASE ADAPTER INTERFACE =====
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

// ===== DOCUMENT BASE TYPE =====
export interface BaseDocument {
  id: string;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  [key: string]: any; // Index signature for dynamic fields
}

// ===== Query Filter Type =====
export type QueryFilter<T extends BaseDocument = BaseDocument> = {
  [K in keyof T]?: T[K] | { $eq?: T[K]; $ne?: T[K]; $gt?: T[K]; $gte?: T[K]; $lt?: T[K]; $lte?: T[K]; $in?: T[K][]; $nin?: T[K][]; $like?: string };
} & {
  $and?: QueryFilter<T>[];
  $or?: QueryFilter<T>[];
};

// ===== Pagination =====
export interface PaginationOptions {
  limit?: number;
  offset?: number;
  sort?: { [key: string]: 'asc' | 'desc' };
}

// ===== CRUD Factory =====
export function createCRUD<T extends BaseDocument = BaseDocument>(
  db: DatabaseAdapter,
  options: { enforceOwnership?: boolean; softDelete?: boolean; defaultLimit?: number } = {}
) {
  const { enforceOwnership = true, softDelete = false, defaultLimit = 100 } = options;

  const generateId = () => crypto.randomBytes(12).toString('hex');

  const applyOwnership = <U extends BaseDocument>(query: QueryFilter<U>, userId?: string): QueryFilter<U> => {
    if (!enforceOwnership || !userId) return query;
    return { ...query, userId: { $eq: userId } };
  };

  const matchFilter = <U extends BaseDocument>(item: any, filter: QueryFilter<U>): boolean => {
    const ops = (field: string, val: any, cond: any): boolean => {
      if (cond === undefined) return val !== undefined;
      if (typeof cond !== 'object') return val === cond;
      if ('$eq' in cond) return val === cond.$eq;
      if ('$ne' in cond) return val !== cond.$ne;
      if ('$gt' in cond) return val > cond.$gt;
      if ('$gte' in cond) return val >= cond.$gte;
      if ('$lt' in cond) return val < cond.$lt;
      if ('$lte' in cond) return val <= cond.$lte;
      if ('$in' in cond) return Array.isArray(cond.$in) && cond.$in.includes(val);
      if ('$nin' in cond) return Array.isArray(cond.$nin) && !cond.$nin.includes(val);
      if ('$like' in cond) return typeof val === 'string' && val.includes(String(cond.$like));
      return true;
    };

    const keys = Object.keys(filter);
    for (const key of keys) {
      const fval: any = (filter as any)[key];
      if (key === '$and') {
        if (!Array.isArray(fval) || !fval.every((f: any) => matchFilter(item, f))) return false;
      } else if (key === '$or') {
        if (!Array.isArray(fval) || !fval.some((f: any) => matchFilter(item, f))) return false;
      } else {
        if (!ops(key, (item as any)[key], fval)) return false;
      }
    }
    return true;
  };

  const applySoftDelete = (items: T[]): T[] => {
    if (!softDelete) return items;
    return items.filter(i => !i.deletedAt);
  };

  const applySort = (items: T[], sort?: { [key: string]: 'asc' | 'desc' }) => {
    if (!sort) return items;
    const keys = Object.keys(sort);
    return [...items].sort((a, b) => {
      for (const k of keys) {
        const aVal = (a as any)[k];
        const bVal = (b as any)[k];
        if (aVal === bVal) continue;
        return sort[k] === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal > bVal ? -1 : 1);
      }
      return 0;
    });
  };

  return {
    async create(collection: string, data: Partial<T>, userId?: string): Promise<T> {
      const now = new Date().toISOString();
      const doc = {
        id: generateId(),
        createdAt: now,
        updatedAt: now,
        ...(userId && { userId }),
        ...data
      } as T;
      return db.create(collection, doc);
    },

    async createMany(collection: string, items: Array<Partial<T>>, userId?: string): Promise<T[]> {
      const now = new Date().toISOString();
      const docs = items.map(item => ({
        id: generateId(),
        createdAt: now,
        updatedAt: now,
        ...(userId && { userId }),
        ...item
      })) as T[];
      
      const results: T[] = [];
      for (const doc of docs) {
        results.push(await db.create(collection, doc));
      }
      return results;
    },

    async readOne(collection: string, id: string, userId?: string): Promise<T | null> {
      const filter = applyOwnership({ id }, userId);
      const results = await db.read(collection, filter);
      const filtered = applySoftDelete(results);
      return filtered[0] || null;
    },

    async read(
      collection: string,
      filter: QueryFilter<T> = {},
      options: PaginationOptions = {},
      userId?: string
    ): Promise<T[]> {
      const safeFilter = applyOwnership(filter, userId);
      let items: T[] = [];

      if (db.advancedRead) {
        items = await db.advancedRead(collection, safeFilter, options);
      } else {
        const raw = await db.read(collection, {});
        items = applySoftDelete(raw).filter(i => matchFilter(i, safeFilter));
      }

      if (options.sort) items = applySort(items, options.sort);
      if (options.offset || options.limit !== undefined) {
        const start = options.offset || 0;
        const end = start + (options.limit ?? items.length);
        items = items.slice(start, end);
      }

      return items;
    },

    async updateOne(collection: string, id: string, data: Partial<T>, userId?: string): Promise<T | null> {
      const filter = applyOwnership({ id }, userId);
      const results = await db.read(collection, filter);
      if (results.length === 0) return null;
      
      const updateData = { ...data, updatedAt: new Date().toISOString() };
      await db.update(collection, filter, updateData);
      return { ...results[0], ...updateData } as T;
    },

    async updateMany(collection: string, filter: QueryFilter<T>, data: Partial<T>, userId?: string): Promise<number> {
      const safeFilter = applyOwnership(filter, userId);
      const items = await this.read(collection, safeFilter, {}, userId);
      const updateData = { ...data, updatedAt: new Date().toISOString() };
      
      for (const item of items) {
        await db.update(collection, { id: item.id }, updateData);
      }
      return items.length;
    },

    async deleteOne(collection: string, id: string, userId?: string): Promise<T | null> {
      const filter = applyOwnership({ id }, userId);
      const results = await db.read(collection, filter);
      if (results.length === 0) return null;

      if (softDelete) {
        await db.update(collection, filter, { deletedAt: new Date().toISOString() });
        return results[0] as T;
      } else {
        await db.delete(collection, filter);
        return results[0] as T;
      }
    },

    async deleteMany(collection: string, filter: QueryFilter<T>, userId?: string): Promise<number> {
      const safeFilter = applyOwnership(filter, userId);
      const items = await this.read(collection, safeFilter, {}, userId);
      
      if (softDelete) {
        for (const item of items) {
          await db.update(collection, { id: item.id }, { deletedAt: new Date().toISOString() });
        }
      } else {
        await db.delete(collection, safeFilter);
      }
      return items.length;
    },

    async restore(collection: string, id: string, userId?: string): Promise<T | null> {
      if (!softDelete) throw new Error('Soft delete not enabled');
      const filter = applyOwnership({ id, deletedAt: { $ne: null } }, userId);
      const results = await db.read(collection, filter);
      if (results.length === 0) return null;
      
      // ✅ FIX: Set deletedAt to null to explicitly restore
      const updateData = { ...results[0], deletedAt: null, updatedAt: new Date().toISOString() };
      await db.update(collection, filter, updateData);
      return this.readOne(collection, id, userId);
    },

    async count(collection: string, filter: QueryFilter<T> = {}, userId?: string): Promise<number> {
      const safeFilter = applyOwnership(filter, userId);
      const raw = await db.read(collection, {});
      return applySoftDelete(raw).filter(i => matchFilter(i, safeFilter)).length;
    },

    async exists(collection: string, filter: QueryFilter<T>, userId?: string): Promise<boolean> {
      const count = await this.count(collection, filter, userId);
      return count > 0;
    },

    async paginate(
      collection: string, 
      filter: QueryFilter<T> = {}, 
      page: number = 1, 
      limit: number = defaultLimit, 
      userId?: string
    ) {
      const offset = (page - 1) * limit;
      const items = await this.read(collection, filter, { limit, offset }, userId);
      const total = await this.count(collection, filter, userId);
      
      return {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      };
    }
  };
}

// ===== CRUD Controller (Handler Wrapper) =====
export function createCrudController<T extends BaseDocument = BaseDocument>(
  modelInfoOrAdapter: any,
  collectionName?: string
) {
  let adapter: DatabaseAdapter;
  let collection: string;

  if (collectionName) {
    adapter = modelInfoOrAdapter;
    collection = collectionName;
  } else if (modelInfoOrAdapter && modelInfoOrAdapter.adapter && modelInfoOrAdapter.collection) {
    adapter = modelInfoOrAdapter.adapter;
    collection = modelInfoOrAdapter.collection;
  } else {
    throw new Error('Invalid arguments to createCrudController. Expected (adapter, collection) or ({ adapter, collection })');
  }

  const service = createCRUD<T>(adapter);

  return {
    getAll: async (ctx: any) => {
      const { limit, offset, ...filters } = ctx.query;
      const results = await service.read(collection, filters, {
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined
      }, ctx.req.user?.id);
      ctx.json(results);
    },

    getOne: async (ctx: any) => {
      const result = await service.readOne(collection, ctx.params.id, ctx.req.user?.id);
      if (!result) return ctx.status(404).json({ error: 'Not Found' });
      ctx.json(result);
    },

    create: async (ctx: any) => {
      const result = await service.create(collection, ctx.body, ctx.req.user?.id);
      ctx.status(201).json(result);
    },

    update: async (ctx: any) => {
      const result = await service.updateOne(collection, ctx.params.id, ctx.body, ctx.req.user?.id);
      if (!result) return ctx.status(404).json({ error: 'Not Found' });
      ctx.json(result);
    },

    delete: async (ctx: any) => {
      const result = await service.deleteOne(collection, ctx.params.id, ctx.req.user?.id);
      if (!result) return ctx.status(404).json({ error: 'Not Found' });
      ctx.json({ success: true, deleted: result });
    }
  };
}