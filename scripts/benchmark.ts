import { createDolphinServer } from '../server/server';

const app = createDolphinServer();

app.get('/health', (ctx: any) => {
  ctx.json({ status: 'ok' });
});

const PORT = 5002;
app.listen(PORT, () => {
  console.log(`Benchmark server running on port ${PORT}`);
});
