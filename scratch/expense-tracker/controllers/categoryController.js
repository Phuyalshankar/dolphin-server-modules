import { createCRUD } from 'dolphin-server-modules/crud';
import Category from '../models/Category.js';

export const categoryCRUD = createCRUD(Category);