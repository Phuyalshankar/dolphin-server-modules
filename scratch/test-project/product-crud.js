import { createCRUD } from 'dolphin-server-modules/crud';

export function setupProductCRUD(dbAdapter) {
    const service = createCRUD(dbAdapter, { enforceOwnership: false });
    const COLLECTION = 'Product';
    
    return {
        getAll: async (ctx) => ctx.json(await service.read(COLLECTION, ctx.query)),
        getOne: async (ctx) => ctx.json(await service.readOne(COLLECTION, ctx.params.id)),
        create: async (ctx) => ctx.json(await service.create(COLLECTION, ctx.body)),
        update: async (ctx) => ctx.json(await service.updateOne(COLLECTION, ctx.params.id, ctx.body)),
        delete: async (ctx) => ctx.json(await service.deleteOne(COLLECTION, ctx.params.id))
    };
}