import { createDolphinServer } from 'dolphin-server-modules/server';
import { createCrudController } from 'dolphin-server-modules/crud';

const app = createDolphinServer();

// User API
const userController = createCrudController('users');
app.get('/api/users', userController.getAll);

// Product API
const productController = createCrudController('products');
app.get('/api/products', productController.getAll);

app.listen(5000, () => {
  console.log('Server listening on port 5000');
});