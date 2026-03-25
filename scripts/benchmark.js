const { createDolphinServer } = require('../dist/server/server');

const app = createDolphinServer();

app.get('/health', (ctx) => {
  ctx.json({ status: 'ok' });
});

const PORT = 5008;
app.listen(PORT, () => {
  console.log(`Benchmark server running on port ${PORT}`);
});
