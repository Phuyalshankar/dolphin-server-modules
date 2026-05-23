import { createServer } from 'dolphin-server-modules';
import authModule from './modules/auth.js';
import orderModule from './modules/orders.js';
const server = createServer();
server.registerModule(authModule);
server.registerModule(orderModule);
server.start();