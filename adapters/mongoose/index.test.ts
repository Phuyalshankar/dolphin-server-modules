import { createMongooseAdapter } from './index';

describe('Mongoose Adapter', () => {
  it('should map id to _id in queries', () => {
    // Mock config
    const mockModel: any = {
      create: jest.fn(),
      findOne: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      deleteOne: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      find: jest.fn().mockImplementation(() => {
        const queryObj = {
          sort: jest.fn().mockReturnThis(),
          skip: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          then: function(resolve: any) { resolve([]); }
        };
        return queryObj;
      })
    };
    
    const adapter = createMongooseAdapter({
      User: mockModel,
      RefreshToken: mockModel,
      models: { test: mockModel }
    });

    // We can't easily test the internals without exporting them, 
    // but we can trigger them via the public methods.
    adapter.read('test', { id: '123', name: { $like: 'john' } });
    
    expect(mockModel.find).toHaveBeenCalledWith({
      _id: '123',
      name: { $regex: 'john', $options: 'i' }
    });
  });

  it('should map returned documents to standard shape', async () => {
    const mockDoc = {
      _id: 'some-id',
      __v: 0,
      name: 'Test User',
      toObject: () => ({ _id: 'some-id', __v: 0, name: 'Test User' })
    };

    const mockModel: any = {
      create: jest.fn().mockResolvedValue(mockDoc),
    };

    const adapter = createMongooseAdapter({
      User: mockModel,
      RefreshToken: mockModel,
      models: { test: mockModel }
    });

    const result = await adapter.createUser({ name: 'Test User' });
    
    expect(result).toEqual({
      id: 'some-id',
      name: 'Test User'
    });
    expect(result._id).toBeUndefined();
    expect(result.__v).toBeUndefined();
  });
});
