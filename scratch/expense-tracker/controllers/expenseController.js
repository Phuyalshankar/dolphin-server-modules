import { createCRUD } from 'dolphin-server-modules/crud';
import Expense from '../models/Expense.js';

export const expenseCRUD = createCRUD(Expense);