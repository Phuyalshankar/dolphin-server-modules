import { createDolphinServer } from 'dolphin-server-modules/server';
const app = createDolphinServer();

app.get('/', (ctx) => ctx.json({ message: 'Dolphin Server is running!' }));

app.listen(3000, () => console.log('🐬 Dolphin swimming on port 3000'));