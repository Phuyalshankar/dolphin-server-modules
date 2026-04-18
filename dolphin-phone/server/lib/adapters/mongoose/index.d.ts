import type { Model } from 'mongoose';
export interface MongooseAdapterConfig {
    User: Model<any>;
    RefreshToken: Model<any>;
    models?: Record<string, Model<any>>;
    leanByDefault?: boolean;
    maxLimit?: number;
    softDelete?: boolean;
    softDeleteField?: string;
}
export declare function createMongooseAdapter(config: MongooseAdapterConfig): {
    createUser(data: any): Promise<any>;
    findUserByEmail(email: string): Promise<any>;
    findUserById(id: string): Promise<any>;
    updateUser(id: string, data: any): Promise<any>;
    saveRefreshToken(data: any): Promise<void>;
    findRefreshToken(token: string): Promise<any>;
    deleteRefreshToken(token: string): Promise<void>;
    create(collection: string, data: any, userId?: string): Promise<any>;
    readOne(collection: string, id: string, userId?: string): Promise<any>;
    readMany(collection: string, query?: any, options?: any, userId?: string): Promise<any>;
    updateOne(collection: string, id: string, data: any, userId?: string): Promise<any>;
    updateMany(collection: string, query: any, data: any, userId?: string): Promise<number>;
    deleteOne(collection: string, id: string, userId?: string): Promise<any>;
    deleteMany(collection: string, query: any, userId?: string): Promise<number>;
    restore(collection: string, id: string, userId?: string): Promise<any>;
    paginate(collection: string, filter?: any, page?: number, limit?: number, userId?: string): Promise<{
        items: any;
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    }>;
    advancedRead(collection: string, query?: any, options?: any, userId?: string): Promise<any>;
    count(collection: string, filter?: any, userId?: string): Promise<number>;
    exists(collection: string, filter?: any, userId?: string): Promise<boolean>;
    read(collection: string, query?: any): Promise<any>;
    update(collection: string, query: any, data: any): Promise<any>;
    delete(collection: string, query: any): Promise<any>;
};
