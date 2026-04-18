"use strict";
// crud.ts — Complete Working Version (All Tests Pass)
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCRUD = createCRUD;
exports.createCrudController = createCrudController;
const node_crypto_1 = __importDefault(require("node:crypto"));
// ===== HELPER: Fix ID for Mongoose =====
const fixId = (query) => {
    if (!query)
        return query;
    if (query.id !== undefined) {
        query._id = query.id;
        delete query.id;
    }
    return query;
};
// ===== SAFE METHOD CALLS =====
const safeUpdate = async (db, collection, filter, data) => {
    const method = db.update || db.updateOne;
    if (!method)
        throw new Error('No update method');
    return method.call(db, collection, fixId(filter), data);
};
const safeDelete = async (db, collection, filter) => {
    const method = db.delete || db.deleteOne;
    if (!method)
        throw new Error('No delete method');
    return method.call(db, collection, fixId(filter));
};
// ===== MATCH FILTER (Type Safe) =====
const matchFilter = (item, filter) => {
    for (const [key, val] of Object.entries(filter)) {
        if (key === '$and') {
            if (!Array.isArray(val) || !val.every((f) => matchFilter(item, f)))
                return false;
        }
        else if (key === '$or') {
            if (!Array.isArray(val) || !val.some((f) => matchFilter(item, f)))
                return false;
        }
        else {
            const itemVal = item[key];
            if (val && typeof val === 'object' && !Array.isArray(val)) {
                const op = val;
                if (op.$eq !== undefined && itemVal !== op.$eq)
                    return false;
                if (op.$ne !== undefined && itemVal === op.$ne)
                    return false;
                if (op.$gt !== undefined && itemVal <= op.$gt)
                    return false;
                if (op.$gte !== undefined && itemVal < op.$gte)
                    return false;
                if (op.$lt !== undefined && itemVal >= op.$lt)
                    return false;
                if (op.$lte !== undefined && itemVal > op.$lte)
                    return false;
                if (op.$in !== undefined && !op.$in.includes(itemVal))
                    return false;
                if (op.$nin !== undefined && op.$nin.includes(itemVal))
                    return false;
                if (op.$like !== undefined && !String(itemVal).includes(String(op.$like)))
                    return false;
            }
            else if (itemVal !== val)
                return false;
        }
    }
    return true;
};
function createCRUD(db, options = {}) {
    const { enforceOwnership = true, softDelete = false, defaultLimit = 100 } = options;
    const generateId = () => node_crypto_1.default.randomBytes(12).toString('hex');
    const withOwnership = (filter, userId) => {
        if (enforceOwnership && !userId)
            return { _id: null };
        if (!enforceOwnership || !userId)
            return filter;
        return { ...filter, userId };
    };
    const filterDeleted = (items) => {
        if (!softDelete)
            return items;
        return items.filter(i => !i.deletedAt);
    };
    const sortItems = (items, sort) => {
        if (!sort)
            return items;
        const keys = Object.keys(sort);
        return [...items].sort((a, b) => {
            for (const k of keys) {
                const av = a[k];
                const bv = b[k];
                if (av === bv)
                    continue;
                return sort[k] === 'asc' ? (av > bv ? 1 : -1) : (av > bv ? -1 : 1);
            }
            return 0;
        });
    };
    return {
        async create(collection, data, userId) {
            const now = new Date().toISOString();
            const doc = { id: generateId(), createdAt: now, updatedAt: now, ...(userId && { userId }), ...data };
            return db.create(collection, doc);
        },
        async createMany(collection, items, userId) {
            const now = new Date().toISOString();
            const docs = items.map(item => ({ id: generateId(), createdAt: now, updatedAt: now, ...(userId && { userId }), ...item }));
            return Promise.all(docs.map(doc => db.create(collection, doc)));
        },
        async readOne(collection, id, userId) {
            if (enforceOwnership && !userId)
                return null;
            let results = await db.read(collection, withOwnership({ id }, userId));
            if (results.length === 0) {
                results = await db.read(collection, withOwnership({ _id: id }, userId));
            }
            const filtered = filterDeleted(results);
            return filtered[0] || null;
        },
        async read(collection, filter = {}, options = {}, userId) {
            if (enforceOwnership && !userId)
                return [];
            let items = [];
            const finalFilter = fixId(withOwnership(filter, userId));
            if (db.advancedRead) {
                items = await db.advancedRead(collection, finalFilter, options);
            }
            else {
                const raw = await db.read(collection, {});
                items = filterDeleted(raw).filter(i => matchFilter(i, finalFilter));
            }
            if (options.sort)
                items = sortItems(items, options.sort);
            if (options.offset || options.limit !== undefined) {
                const start = options.offset || 0;
                const end = start + (options.limit ?? items.length);
                items = items.slice(start, end);
            }
            return items;
        },
        async updateOne(collection, id, data, userId) {
            if (enforceOwnership && !userId)
                return null;
            let filter = withOwnership({ id }, userId);
            let results = await db.read(collection, filter);
            if (results.length === 0) {
                filter = withOwnership({ _id: id }, userId);
                results = await db.read(collection, filter);
            }
            if (results.length === 0)
                return null;
            const updateData = { ...data, updatedAt: new Date().toISOString() };
            await safeUpdate(db, collection, filter, updateData);
            return { ...results[0], ...updateData };
        },
        async updateMany(collection, filter, data, userId) {
            if (enforceOwnership && !userId)
                return 0;
            const items = await this.read(collection, withOwnership(filter, userId), {}, userId);
            const updateData = { ...data, updatedAt: new Date().toISOString() };
            await Promise.all(items.map(item => safeUpdate(db, collection, { id: item.id }, updateData)));
            return items.length;
        },
        async deleteOne(collection, id, userId) {
            if (enforceOwnership && !userId)
                return null;
            let filter = withOwnership({ id }, userId);
            let results = await db.read(collection, filter);
            if (results.length === 0) {
                filter = withOwnership({ _id: id }, userId);
                results = await db.read(collection, filter);
            }
            if (results.length === 0)
                return null;
            if (softDelete) {
                await db.update(collection, filter, { deletedAt: new Date().toISOString() });
                return results[0];
            }
            else {
                await safeDelete(db, collection, filter);
                return results[0];
            }
        },
        async deleteMany(collection, filter, userId) {
            if (enforceOwnership && !userId)
                return 0;
            const items = await this.read(collection, withOwnership(filter, userId), {}, userId);
            if (softDelete) {
                await Promise.all(items.map(item => db.update(collection, { id: item.id }, { deletedAt: new Date().toISOString() })));
            }
            else {
                await safeDelete(db, collection, fixId(withOwnership(filter, userId)));
            }
            return items.length;
        },
        async restore(collection, id, userId) {
            if (!softDelete)
                throw new Error('Soft delete not enabled');
            if (enforceOwnership && !userId)
                return null;
            // Search by id first
            let filter = withOwnership({ id, deletedAt: { $ne: null } }, userId);
            let results = await db.read(collection, filter);
            // Then try by _id
            if (results.length === 0) {
                filter = withOwnership({ _id: id, deletedAt: { $ne: null } }, userId);
                results = await db.read(collection, filter);
            }
            if (results.length === 0)
                return null;
            // Remove deletedAt field
            await db.update(collection, filter, {
                deletedAt: null,
                updatedAt: new Date().toISOString()
            });
            // Return restored document
            return this.readOne(collection, id, userId);
        },
        async count(collection, filter = {}, userId) {
            if (enforceOwnership && !userId)
                return 0;
            const raw = await db.read(collection, {});
            return filterDeleted(raw).filter(i => matchFilter(i, fixId(withOwnership(filter, userId)))).length;
        },
        async exists(collection, filter, userId) {
            return (await this.count(collection, filter, userId)) > 0;
        },
        async paginate(collection, filter = {}, page = 1, limit = defaultLimit, userId) {
            const offset = (page - 1) * limit;
            const items = await this.read(collection, filter, { limit, offset }, userId);
            const total = await this.count(collection, filter, userId);
            return { items, total, page, limit, totalPages: Math.ceil(total / limit), hasNext: page * limit < total, hasPrev: page > 1 };
        }
    };
}
function createCrudController(adapter, collection, options) {
    const service = createCRUD(adapter, options);
    return {
        getAll: async (ctx) => {
            const { limit, offset, ...filters } = ctx.query;
            const results = await service.read(collection, filters, { limit: limit ? parseInt(limit) : undefined, offset: offset ? parseInt(offset) : undefined }, ctx.req?.user?.id);
            ctx.json(results);
        },
        getOne: async (ctx) => {
            const result = await service.readOne(collection, ctx.params.id, ctx.req?.user?.id);
            if (!result)
                return ctx.status(404).json({ error: 'Not Found' });
            ctx.json(result);
        },
        create: async (ctx) => {
            const result = await service.create(collection, ctx.body, ctx.req?.user?.id);
            ctx.status(201).json(result);
        },
        update: async (ctx) => {
            const result = await service.updateOne(collection, ctx.params.id, ctx.body, ctx.req?.user?.id);
            if (!result)
                return ctx.status(404).json({ error: 'Not Found' });
            ctx.json(result);
        },
        delete: async (ctx) => {
            const result = await service.deleteOne(collection, ctx.params.id, ctx.req?.user?.id);
            if (!result)
                return ctx.status(404).json({ error: 'Not Found' });
            ctx.json({ success: true, deleted: result });
        }
    };
}
//# sourceMappingURL=crud.js.map