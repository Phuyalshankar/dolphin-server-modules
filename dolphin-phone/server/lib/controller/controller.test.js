"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const controller_1 = require("./controller");
describe('Controller Factory', () => {
    let mockCrud;
    beforeEach(() => {
        mockCrud = {
            paginate: jest.fn().mockResolvedValue({ items: [], total: 0 }),
            read: jest.fn().mockResolvedValue([{ id: '1' }]),
            readOne: jest.fn().mockResolvedValue({ id: '1' }),
            create: jest.fn().mockImplementation((col, data) => Promise.resolve({ id: '2', ...data })),
            updateOne: jest.fn().mockImplementation((col, id, data) => Promise.resolve({ id, ...data })),
            deleteOne: jest.fn().mockResolvedValue(true),
        };
    });
    it('maps standard controller methods to CRUD operations', async () => {
        const ctrl = (0, controller_1.createDolphinController)(mockCrud, 'posts', { softDelete: false });
        const listRes = await ctrl.list({ query: { category: 'news' } });
        expect(mockCrud.read).toHaveBeenCalledWith('posts', { category: 'news' }, {}, undefined);
        expect(listRes).toEqual([{ id: '1' }]);
        const createRes = await ctrl.create({ body: { title: 'Test' } });
        expect(mockCrud.create).toHaveBeenCalledWith('posts', { title: 'Test' }, undefined);
        expect(createRes.title).toBe('Test');
    });
    it('maps next pages handler correctly', async () => {
        const ctrl = (0, controller_1.createDolphinController)(mockCrud, 'posts');
        const handler = (0, controller_1.createNextPagesHandler)(ctrl);
        const req = { method: 'GET', query: { id: '1' } };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        await handler(req, res);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ id: '1' });
        expect(mockCrud.readOne).toHaveBeenCalledWith('posts', '1', undefined);
    });
});
//# sourceMappingURL=controller.test.js.map