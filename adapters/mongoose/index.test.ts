import { createMongooseAdapter } from './index';

describe('Mongoose Adapter', () => {
  let adapter: any;
  let mockModel: any;

  beforeEach(() => {
    // Helper to create chainable mock for mongoose queries (generic)
    const chainable = <T = any>(result?: T) => {
      const chain = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(result),
        then: jest.fn().mockResolvedValue(result),
        exec: jest.fn().mockResolvedValue(result),
      };
      return chain;
    };

    mockModel = {
      create: jest.fn(),
      find: jest.fn(() => chainable([])),
      findOne: jest.fn(() => chainable(undefined)),
      findById: jest.fn(() => chainable(undefined)),
      findByIdAndUpdate: jest.fn(() => chainable(undefined)),
      findByIdAndDelete: jest.fn(() => chainable(undefined)),
      findOneAndUpdate: jest.fn(() => chainable(undefined)),
      findOneAndDelete: jest.fn(() => chainable(undefined)),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      insertMany: jest.fn(),
      deleteOne: jest.fn(),
      countDocuments: jest.fn().mockResolvedValue(0),
    };

    adapter = createMongooseAdapter({
      User: mockModel,
      RefreshToken: mockModel,
      models: { test: mockModel },
      leanByDefault: true,
    });
  });

  it('should map id to _id and $like in queries', async () => {
    await adapter.read('test', { 
      id: '123', 
      name: { $like: 'john' } 
    });

    expect(mockModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: '123',
        name: { $regex: 'john', $options: 'i' }
      })
    );
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

    expect(mockModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: '123' },
      expect.objectContaining({ name: 'Updated' }),
      expect.objectContaining({ new: true })
    );
    expect(result.id).toBe('123');
  });

  it('should support advancedRead with sort, offset and limit', async () => {
    await adapter.advancedRead('test', { status: 'active' }, {
      sort: { createdAt: 'desc' },
      offset: 10,
      limit: 20
    });

    expect(mockModel.find).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'active' })
    );
  });

  it('should attach model shortcuts correctly', () => {
    expect(adapter.User).toBeDefined();
    expect(adapter.test).toBeDefined();
    expect(adapter.RefreshToken).toBeDefined();

    expect(adapter.User.collection).toBe('User');
    expect(adapter.test.collection).toBe('test');
  });
});