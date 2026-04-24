const { createDolphinServer } = require('dolphin-server-modules/server');

const app = createDolphinServer();

app.get('/ping', (ctx) => {
  return { message: 'pong', version: '1.0.0' };
});

app.listen(3000, () => console.log("🐬 Dolphin server running on port 3000"));