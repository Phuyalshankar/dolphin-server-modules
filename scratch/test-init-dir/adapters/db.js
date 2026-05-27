import { createMongooseAdapter } from 'dolphin-server-modules/adapters/mongoose';
import { User, RefreshToken } from '../models/User.js';
import { Product } from '../models/Product.js';

export const db = createMongooseAdapter({
  User,
  RefreshToken,
  models: {
    User,
    Product,
  },
  leanByDefault: true,
  softDelete: false
});
