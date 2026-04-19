import { createDolphinServer } from 'dolphin-server-modules/server';

const app = createDolphinServer();

app.get('/health', (ctx) => ({
  uptime: process.uptime()
}));

app.listen(3000, () => console.log('Server started'));