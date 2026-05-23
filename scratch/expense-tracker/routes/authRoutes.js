import { authController } from '../controllers/authController.js';

export default (router) => {
  router.post('/auth/register', (ctx) => authController.register(ctx));
  router.post('/auth/login', (ctx) => authController.login(ctx));
};