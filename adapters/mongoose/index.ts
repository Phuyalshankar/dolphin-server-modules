import type { Model } from 'mongoose';

export interface MongooseAdapterConfig {
  User: Model<any>;
  RefreshToken: Model<any>;
  models?: Record<string, Model<any>>;
}

export function createMongooseAdapter(config: MongooseAdapterConfig) {
  // Map MongoDB document to the standard BaseDocument shape
  const mapDoc = (doc: any) => {
    if (!doc) return null;
    const obj = doc.toObject && typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
    if (obj._id) {
      obj.id = obj._id.toString();
      delete obj._id;
    }
    delete obj.__v;
    return obj;
  };

  // Convert standard QueryFilter to Mongoose Query format
  const mapQuery = (query: any) => {
    if (!query) return {};
    const parsed: any = {};
    for (const [key, val] of Object.entries(query)) {
      if (key === 'id') {
        parsed['_id'] = val;
      } else if (key === '$and' || key === '$or') {
        parsed[key] = (val as any[]).map(mapQuery);
      } else if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
        const ops: any = {};
        for (const [op, opVal] of Object.entries(val)) {
          if (op === '$like') {
            ops['$regex'] = opVal;
            ops['$options'] = 'i';
          } else {
            ops[op] = opVal;
          }
        }
        parsed[key] = ops;
      } else {
        parsed[key] = val;
      }
    }
    return parsed;
  };

  // Convert standard sorting to Mongoose sort format
  const mapSort = (sort?: Record<string, 'asc' | 'desc'>) => {
    if (!sort) return undefined;
    const result: Record<string, 1 | -1> = {};
    for (const [k, v] of Object.entries(sort)) {
      result[k] = v === 'asc' ? 1 : -1;
    }
    return result;
  };

  // Helper to fetch generic CRUD models
  const getModel = (collection: string): Model<any> => {
    if (!config.models || !config.models[collection]) {
      throw new Error(`Model for collection '${collection}' not found in MongooseAdapterConfig`);
    }
    return config.models[collection];
  };

  const adapter = {
    // ==========================================
    // AUTHENTICATION ADAPTER METHODS
    // ==========================================
    async createUser(data: any) {
      const user = await config.User.create(data);
      return mapDoc(user);
    },
    async findUserByEmail(email: string) {
      const user = await config.User.findOne({ email });
      return mapDoc(user);
    },
    async findUserById(id: string) {
      const user = await config.User.findById(id);
      return mapDoc(user);
    },
    async updateUser(id: string, data: any) {
      const user = await config.User.findByIdAndUpdate(id, data, { new: true });
      return mapDoc(user);
    },
    async saveRefreshToken(data: any) {
      await config.RefreshToken.create(data);
    },
    async findRefreshToken(token: string) {
      const rt = await config.RefreshToken.findOne({ token });
      return mapDoc(rt);
    },
    async deleteRefreshToken(token: string) {
      await config.RefreshToken.deleteOne({ token });
    },

    // ==========================================
    // CRUD ADAPTER METHODS
    // ==========================================
    async create(collection: string, data: any) {
      const Model = getModel(collection);
      const doc = await Model.create(data);
      return mapDoc(doc);
    },
    async read(collection: string, query: any) {
      const Model = getModel(collection);
      const docs = await Model.find(mapQuery(query));
      return docs.map(mapDoc);
    },
    async update(collection: string, query: any, data: any) {
      const Model = getModel(collection);
      await Model.updateMany(mapQuery(query), data);
      
      // Return updated documents if we can map them back, otherwise minimal info
      // Since updateMany doesn't return the updated docs in mongoose, we can just return a generic success object 
      // or fetch them. The interface expects Promise<any>. We will fetch them to match typical behavior.
      const docs = await Model.find(mapQuery({ ...query, ...data }));
      return docs.map(mapDoc);
    },
    async delete(collection: string, query: any) {
      const Model = getModel(collection);
      await Model.deleteMany(mapQuery(query));
      return { deleted: true };
    },
    async advancedRead(collection: string, query: any, options: any) {
      const Model = getModel(collection);
      let mQuery = Model.find(mapQuery(query));
      if (options.sort) {
        mQuery = mQuery.sort(mapSort(options.sort));
      }
      if (options.offset !== undefined) {
        mQuery = mQuery.skip(options.offset);
      }
      if (options.limit !== undefined) {
        mQuery = mQuery.limit(options.limit);
      }
      const docs = await mQuery;
      return docs.map(mapDoc);
    }
  };

  // ✅ NEW: Attach model metadata for createCrudController(db.ModelName) support
  if (config.models) {
    Object.keys(config.models).forEach((key) => {
      (adapter as any)[key] = { adapter, collection: key };
    });
  }

  // Also attach standard User/RefreshToken if they are not in models but passed in config
  if (config.User && (!config.models || !config.models['User'])) {
    (adapter as any)['User'] = { adapter, collection: 'User' };
  }
  if (config.RefreshToken && (!config.models || !config.models['RefreshToken'])) {
    (adapter as any)['RefreshToken'] = { adapter, collection: 'RefreshToken' };
  }

  return adapter;
}
