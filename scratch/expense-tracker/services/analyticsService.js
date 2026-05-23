import Expense from '../models/Expense.js';

export const getUserStats = async (ctx) => {
  const userId = ctx.user.id;
  const stats = await Expense.aggregate([
    { $match: { user: userId } },
    { $group: { _id: '$category', total: { $sum: '$amount' } } }
  ]);
  return { success: true, data: stats };
};