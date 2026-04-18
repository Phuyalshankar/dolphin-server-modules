"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// adapters/mongoose/index.test.ts
const index_1 = require("./index");
describe('Mongoose Adapter', () => {
    let adapter;
    let mockModel;
    let mockChainable;
    beforeEach(() => {
        // Helper to create chainable mock for mongoose queries
        const createChainable = (result) => {
            const chain = {
                sort: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                populate: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue(result || []),
                then: jest.fn().mockResolvedValue(result || []),
                exec: jest.fn().mockResolvedValue(result || [])
            };
            return chain;
        };
        mockChainable = createChainable();
        mockModel = {
            create: jest.fn(),
            find: jest.fn(() => createChainable([])),
            findOne: jest.fn(() => createChainable(null)),
            findById: jest.fn(() => createChainable(null)),
            findByIdAndUpdate: jest.fn(() => createChainable(null)),
            findByIdAndDelete: jest.fn(() => createChainable(null)),
            findOneAndUpdate: jest.fn(() => createChainable(null)),
            findOneAndDelete: jest.fn(() => createChainable(null)),
            updateMany: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
            deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
            insertMany: jest.fn(),
            deleteOne: jest.fn().mockResolvedValue({ deletedCount: 0 }),
            countDocuments: jest.fn().mockResolvedValue(0),
            updateOne: jest.fn().mockResolvedValue({ modifiedCount: 0 })
        };
        adapter = (0, index_1.createMongooseAdapter)({
            User: mockModel,
            RefreshToken: mockModel,
            models: { test: mockModel },
            leanByDefault: true,
            softDelete: false
        });
    });
    it('should map id to _id and $like in queries', async () => {
        // Call read with id and $like query
        await adapter.read('test', {
            id: '123',
            name: { $like: 'john' }
        });
        // Verify find was called with converted query
        expect(mockModel.find).toHaveBeenCalledWith(expect.objectContaining({
            _id: '123',
            name: { $regex: 'john', $options: 'i' }
        }));
    });
    it('should map returned documents to standard shape (id instead of _id)', async () => {
        const mockDoc = {
            _id: 'some-id',
            __v: 0,
            name: 'Test User',
            toObject: () => ({ _id: 'some-id', __v: 0, name: 'Test User' })
        };
        mockModel.create.mockResolvedValueOnce(mockDoc);
        const result = await adapter.createUser({ name: 'Test User' });
        expect(result).toEqual({
            id: 'some-id',
            name: 'Test User'
        });
        expect(result._id).toBeUndefined();
        expect(result.__v).toBeUndefined();
    });
    it('should support readOne by id', async () => {
        const mockDoc = { _id: '123', name: 'Test' };
        mockModel.findOne.mockReturnValueOnce({
            lean: jest.fn().mockResolvedValue(mockDoc)
        });
        const result = await adapter.readOne('test', '123');
        expect(mockModel.findOne).toHaveBeenCalledWith({ _id: '123' });
        expect(result).toEqual({ id: '123', name: 'Test' });
    });
    it('should support updateOne', async () => {
        const mockUpdated = { _id: '123', name: 'Updated' };
        mockModel.findOneAndUpdate.mockReturnValueOnce({
            lean: jest.fn().mockResolvedValue(mockUpdated)
        });
        const result = await adapter.updateOne('test', '123', { name: 'Updated' });
        expect(mockModel.findOneAndUpdate).toHaveBeenCalledWith({ _id: '123' }, expect.objectContaining({ name: 'Updated', updatedAt: expect.any(Date) }), { returnDocument: 'after' });
        expect(result.id).toBe('123');
    });
    it('should support advancedRead with sort, offset and limit', async () => {
        const mockDocs = [{ _id: '1', name: 'Test 1' }, { _id: '2', name: 'Test 2' }];
        const mockFind = jest.fn().mockReturnValue({
            sort: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue(mockDocs),
            where: jest.fn().mockReturnThis()
        });
        mockModel.find = mockFind;
        await adapter.advancedRead('test', { status: 'active' }, {
            sort: { createdAt: 'desc' },
            offset: 10,
            limit: 20
        });
        expect(mockModel.find).toHaveBeenCalledWith(expect.objectContaining({ status: 'active' }));
    });
    it('should attach model shortcuts correctly', () => {
        expect(adapter.User).toBeDefined();
        expect(adapter.test).toBeDefined();
        expect(adapter.RefreshToken).toBeDefined();
        expect(adapter.User.collection).toBe('User');
        expect(adapter.test.collection).toBe('test');
    });
    // Additional test for read method with empty query
    it('should handle read with empty query', async () => {
        const mockDocs = [{ _id: '1', name: 'Test 1' }, { _id: '2', name: 'Test 2' }];
        mockModel.find.mockReturnValueOnce({
            lean: jest.fn().mockResolvedValue(mockDocs)
        });
        const results = await adapter.read('test', {});
        expect(mockModel.find).toHaveBeenCalledWith({});
        expect(results).toHaveLength(2);
        expect(results[0]).toEqual({ id: '1', name: 'Test 1' });
        expect(results[1]).toEqual({ id: '2', name: 'Test 2' });
    });
    // Test for update method (CRUD controller compatibility)
    it('should support update method for CRUD controller', async () => {
        mockModel.updateMany.mockResolvedValueOnce({ modifiedCount: 2 });
        const result = await adapter.update('test', { category: 'Electronics' }, { price: 100 });
        expect(mockModel.updateMany).toHaveBeenCalledWith({ category: 'Electronics' }, expect.objectContaining({ price: 100, updatedAt: expect.any(Date) }));
        expect(result).toBe(2);
    });
    // Test for delete method (CRUD controller compatibility)
    it('should support delete method for CRUD controller', async () => {
        mockModel.deleteMany.mockResolvedValueOnce({ deletedCount: 3 });
        const result = await adapter.delete('test', { category: 'Old' });
        expect(mockModel.deleteMany).toHaveBeenCalledWith({ category: 'Old' });
        expect(result).toBe(3);
    });
});
//# sourceMappingURL=index.test.js.map