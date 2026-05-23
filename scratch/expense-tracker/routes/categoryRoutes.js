import { categoryCRUD } from '../controllers/categoryController.js';
import { authGuard } from '../middleware/authMiddleware.js';

export default (router) => {
  router.get('/categories', (ctx) => {
    if (authGuard(ctx) !== true) return;
    return categoryCRUD.findMany({ user: ctx.user.id });
  });

  router.post('/categories', (ctx) => {
    if (authGuard(ctx) !== true) return;
    ctx.body.user = ctx.user.id;
    return categoryCRUD.createOne(ctx.body);
  });
};