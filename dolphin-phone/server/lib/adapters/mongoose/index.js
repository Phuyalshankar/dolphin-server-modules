"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMongooseAdapter = createMongooseAdapter;
function createMongooseAdapter(config) {
    const { User, RefreshToken, models = {}, leanByDefault = true, maxLimit = 100, softDelete = false, softDeleteField = 'deletedAt' } = config;
    // Fast document mapper
    const mapDoc = (doc) => {
        if (!doc)
            return null;
        const obj = doc.toObject?.() ?? { ...doc };
        if (obj._id) {
            obj.id = obj._id.toString();
            delete obj._id;
        }
        delete obj.__v;
        return obj;
    };
    // Fast query mapper
    const mapQuery = (query = {}) => {
        if (!query || typeof query !== 'object')
            return {};
        const parsed = { ...query };
        if (parsed.id) {
            parsed._id = parsed.id;
            delete parsed.id;
        }
        // Handle $like
        for (const key in parsed) {
            if (parsed[key] && typeof parsed[key] === 'object' && parsed[key].$like) {
                parsed[key] = { $regex: parsed[key].$like, $options: 'i' };
            }
        }
        // Handle $and / $or recursively
        if (parsed.$and)
            parsed.$and = parsed.$and.map(mapQuery);
        if (parsed.$or)
            parsed.$or = parsed.$or.map(mapQuery);
        // Auto exclude soft deleted
        if (softDelete && parsed[softDeleteField] === undefined) {
            parsed[softDeleteField] = null;
        }
        return parsed;
    };
    const mapSort = (sort) => {
        if (!sort)
            return undefined;
        const result = {};
        for (const [k, v] of Object.entries(sort)) {
            result[k] = v === 'asc' ? 1 : -1;
        }
        return result;
    };
    const getModel = (collection) => {
        if (collection === 'User')
            return User;
        if (collection === 'RefreshToken')
            return RefreshToken;
        if (models[collection])
            return models[collection];
        throw new Error(`Model '${collection}' not found`);
    };
    const adapter = {
        // ==================== AUTH METHODS ====================
        async createUser(data) {
            const user = await User.create(data);
            return mapDoc(user);
        },
        async findUserByEmail(email) {
            const user = await User.findOne({ email }).lean(leanByDefault);
            return mapDoc(user);
        },
        async findUserById(id) {
            const user = await User.findById(id).lean(leanByDefault);
            return mapDoc(user);
        },
        async updateUser(id, data) {
            const user = await User.findByIdAndUpdate(id, data, { returnDocument: 'after' }).lean(leanByDefault);
            return mapDoc(user);
        },
        async saveRefreshToken(data) {
            await RefreshToken.create(data);
        },
        async findRefreshToken(token) {
            const rt = await RefreshToken.findOne({ token }).lean(leanByDefault);
            return mapDoc(rt);
        },
        async deleteRefreshToken(token) {
            await RefreshToken.deleteOne({ token });
        },
        // ==================== CRUD METHODS ====================
        // Create
        async create(collection, data, userId) {
            const Model = getModel(collection);
            const docData = { ...data };
            if (userId)
                docData.userId = userId;
            const doc = await Model.create(docData);
            return mapDoc(doc);
        },
        // Read one
        async readOne(collection, id, userId) {
            const Model = getModel(collection);
            const query = { _id: id };
            if (userId)
                query.userId = userId;
            if (softDelete)
                query[softDeleteField] = null;
            const doc = await Model.findOne(query).lean(leanByDefault);
            return mapDoc(doc);
        },
        // Read many (internal use)
        async readMany(collection, query = {}, options = {}, userId) {
            const Model = getModel(collection);
            const filter = mapQuery(query);
            if (userId)
                filter.userId = userId;
            let queryBuilder = Model.find(filter).lean(leanByDefault);
            if (options.sort)
                queryBuilder = queryBuilder.sort(mapSort(options.sort));
            if (options.select)
                queryBuilder = queryBuilder.select(options.select);
            if (options.offset)
                queryBuilder = queryBuilder.skip(options.offset);
            const limit = options.limit ? Math.min(options.limit, maxLimit) : undefined;
            if (limit)
                queryBuilder = queryBuilder.limit(limit);
            const docs = await queryBuilder;
            return docs.map(mapDoc);
        },
        // Update one
        async updateOne(collection, id, data, userId) {
            const Model = getModel(collection);
            const query = { _id: id };
            if (userId)
                query.userId = userId;
            if (softDelete)
                query[softDeleteField] = null;
            const doc = await Model.findOneAndUpdate(query, { ...data, updatedAt: new Date() }, { returnDocument: 'after' }).lean(leanByDefault);
            return mapDoc(doc);
        },
        // Update many
        async updateMany(collection, query, data, userId) {
            const Model = getModel(collection);
            const filter = mapQuery(query);
            if (userId)
                filter.userId = userId;
            const result = await Model.updateMany(filter, { ...data, updatedAt: new Date() });
            return result.modifiedCount;
        },
        // Delete one
        async deleteOne(collection, id, userId) {
            const Model = getModel(collection);
            const query = { _id: id };
            if (userId)
                query.userId = userId;
            if (softDelete) {
                const doc = await Model.findOneAndUpdate(query, { [softDeleteField]: new Date(), updatedAt: new Date() }, { returnDocument: 'after' }).lean(leanByDefault);
                return mapDoc(doc);
            }
            else {
                const doc = await Model.findOneAndDelete(query).lean(leanByDefault);
                return mapDoc(doc);
            }
        },
        // Delete many
        async deleteMany(collection, query, userId) {
            const Model = getModel(collection);
            const filter = mapQuery(query);
            if (userId)
                filter.userId = userId;
            if (softDelete) {
                const result = await Model.updateMany(filter, { [softDeleteField]: new Date(), updatedAt: new Date() });
                return result.modifiedCount;
            }
            else {
                const result = await Model.deleteMany(filter);
                return result.deletedCount;
            }
        },
        // Restore (soft delete only)
        async restore(collection, id, userId) {
            if (!softDelete)
                throw new Error('Soft delete not enabled');
            const Model = getModel(collection);
            const query = { _id: id, [softDeleteField]: { $ne: null } };
            if (userId)
                query.userId = userId;
            const doc = await Model.findOneAndUpdate(query, { [softDeleteField]: null, updatedAt: new Date() }, { returnDocument: 'after' }).lean(leanByDefault);
            return mapDoc(doc);
        },
        // Pagination
        async paginate(collection, filter = {}, page = 1, limit = 20, userId) {
            const Model = getModel(collection);
            const query = mapQuery(filter);
            if (userId)
                query.userId = userId;
            const safeLimit = Math.min(limit, maxLimit);
            const skip = (page - 1) * safeLimit;
            const [items, total] = await Promise.all([
                Model.find(query).skip(skip).limit(safeLimit).lean(leanByDefault),
                Model.countDocuments(query)
            ]);
            return {
                items: items.map(mapDoc),
                total,
                page,
                limit: safeLimit,
                totalPages: Math.ceil(total / safeLimit),
                hasNext: page * safeLimit < total,
                hasPrev: page > 1
            };
        },
        // Advanced read with full options
        async advancedRead(collection, query = {}, options = {}, userId) {
            const Model = getModel(collection);
            let mQuery = Model.find(mapQuery(query));
            if (userId)
                mQuery = mQuery.where('userId', userId);
            if (options.sort)
                mQuery = mQuery.sort(mapSort(options.sort));
            if (options.select)
                mQuery = mQuery.select(options.select);
            if (options.populate)
                mQuery = mQuery.populate(options.populate);
            if (options.offset !== undefined)
                mQuery = mQuery.skip(options.offset);
            const limit = options.limit ? Math.min(options.limit, maxLimit) : undefined;
            if (limit)
                mQuery = mQuery.limit(limit);
            const docs = await mQuery.lean(leanByDefault);
            return docs.map(mapDoc);
        },
        // Count
        async count(collection, filter = {}, userId) {
            const Model = getModel(collection);
            const query = mapQuery(filter);
            if (userId)
                query.userId = userId;
            return await Model.countDocuments(query);
        },
        // Exists
        async exists(collection, filter = {}, userId) {
            const count = await this.count(collection, filter, userId);
            return count > 0;
        },
        // ==================== CRUD CONTROLLER COMPATIBILITY METHODS (FIXED) ====================
        // Read method for CRUD controller
        async read(collection, query = {}) {
            const Model = getModel(collection);
            // mapQuery converts id→_id and $like→$regex across the whole query
            const filter = mapQuery(query);
            // Auto exclude soft deleted if enabled
            if (softDelete && filter[softDeleteField] === undefined) {
                filter[softDeleteField] = null;
            }
            const docs = await Model.find(filter).lean(leanByDefault);
            return docs.map(mapDoc);
        },
        // Update method for CRUD controller
        async update(collection, query, data) {
            // If updating by id
            if (query.id || query._id) {
                const id = query.id || query._id;
                return await this.updateOne(collection, id, data);
            }
            // Otherwise update many with mapQuery
            const Model = getModel(collection);
            const filter = mapQuery(query);
            if (softDelete && filter[softDeleteField] === undefined) {
                filter[softDeleteField] = null;
            }
            const result = await Model.updateMany(filter, { ...data, updatedAt: new Date() });
            return result.modifiedCount;
        },
        // Delete method for CRUD controller
        async delete(collection, query) {
            // If deleting by id
            if (query.id || query._id) {
                const id = query.id || query._id;
                return await this.deleteOne(collection, id);
            }
            // Otherwise delete many with mapQuery
            const Model = getModel(collection);
            const filter = mapQuery(query);
            if (softDelete) {
                const result = await Model.updateMany(filter, { [softDeleteField]: new Date(), updatedAt: new Date() });
                return result.modifiedCount;
            }
            else {
                const result = await Model.deleteMany(filter);
                return result.deletedCount;
            }
        }
    };
    // Attach model shortcuts
    if (config.models) {
        Object.keys(config.models).forEach((key) => {
            adapter[key] = { adapter, collection: key };
        });
    }
    adapter.User = { adapter, collection: 'User' };
    adapter.RefreshToken = { adapter, collection: 'RefreshToken' };
    return adapter;
}
//# sourceMappingURL=index.js.map