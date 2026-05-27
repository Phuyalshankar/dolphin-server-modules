import { createCrudController } from 'dolphin-server-modules/crud';
import { db } from '../adapters/db.js';
import { Product } from '../models/Product.js';

const ctrl = createCrudController(db, 'Product', {
  softDelete: true,
  enforceOwnership: false,
});

export const { getAll, getOne, create, update } = ctrl;
export const remove = ctrl.delete;
