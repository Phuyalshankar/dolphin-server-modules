import { expenseCRUD } from '../controllers/expenseController.js';
import { getUserStats } from '../services/analyticsService.js';
import { authGuard } from '../middleware/authMiddleware.js';

export default (router) => {
  // CRUD Operations
  router.get('/expenses', (ctx) => {
    if (authGuard(ctx) !== true) return;
    return expenseCRUD.findMany({ ...ctx.query, user: ctx.user.id });
  });

  router.post('/expenses', (ctx) => {
    if (authGuard(ctx) !== true) return;
    ctx.body.user = ctx.user.id;
    return expenseCRUD.createOne(ctx.body);
  });

  router.get('/expenses/stats', (ctx) => {
    if (authGuard(ctx) !== true) return;
    return getUserStats(ctx);
  });

  router.delete('/expenses/:id', (ctx) => {
    if (authGuard(ctx) !== true) return;
    return expenseCRUD.deleteOne(ctx.params.id);
  });
};