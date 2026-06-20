export interface DatabaseAdapter {
    createUser(data: any): Promise<any>;
    findUserByEmail(email: string): Promise<any>;
    findUserById(id: string): Promise<any>;
    updateUser(id: string, data: any): Promise<any>;
    findUserByResetToken(token: string): Promise<any>;
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
export declare function createCRUD<T extends BaseDocument = BaseDocument>(db: DatabaseAdapter, options?: {
    enforceOwnership?: boolean;
    softDelete?: boolean;
    defaultLimit?: number;
    realtime?: any;
}): {
    create(collection: string, data: Partial<T>, userId?: string): Promise<T>;
    createMany(collection: string, items: Array<Partial<T>>, userId?: string): Promise<T[]>;
    readOne(collection: string, id: string, userId?: string): Promise<T | null>;
    read(collection: string, filter?: any, options?: any, userId?: string): Promise<T[]>;
    updateOne(collection: string, id: string, data: Partial<T>, userId?: string): Promise<T | null>;
    updateMany(collection: string, filter: any, data: Partial<T>, userId?: string): Promise<number>;
    deleteOne(collection: string, id: string, userId?: string): Promise<T | null>;
    deleteMany(collection: string, filter: any, userId?: string): Promise<number>;
    restore(collection: string, id: string, userId?: string): Promise<T | null>;
    count(collection: string, filter?: any, userId?: string): Promise<number>;
    exists(collection: string, filter: any, userId?: string): Promise<boolean>;
    paginate(collection: string, filter?: any, page?: number, limit?: number, userId?: string): Promise<{
        items: T[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    }>;
};
export declare function createCrudController<T extends BaseDocument = BaseDocument>(adapter: any, collection: string, options?: {
    enforceOwnership?: boolean;
    softDelete?: boolean;
    defaultLimit?: number;
}): {
    getAll: (ctx: any) => Promise<void>;
    getOne: (ctx: any) => Promise<any>;
    create: (ctx: any) => Promise<void>;
    update: (ctx: any) => Promise<any>;
    delete: (ctx: any) => Promise<any>;
};
export declare function createCrudRouter<T extends BaseDocument = BaseDocument>(adapter: any, collection: string, options?: {
    enforceOwnership?: boolean;
    softDelete?: boolean;
    defaultLimit?: number;
}): {
    get: (path: string, ...handlers: import("../index.js").Handler[]) => void;
    post: (path: string, ...handlers: import("../index.js").Handler[]) => void;
    put: (path: string, ...handlers: import("../index.js").Handler[]) => void;
    delete: (path: string, ...handlers: import("../index.js").Handler[]) => void;
    patch: (path: string, ...handlers: import("../index.js").Handler[]) => void;
    all: (path: string, ...handlers: import("../index.js").Handler[]) => void;
    use: (prefix: string, subRouter: any) => void;
    _routes: import("../index.js").Route[];
    match(method: string, url: string): {
        handlers: import("../index.js").Handler[];
        params: Record<string, string>;
    } | null;
};
