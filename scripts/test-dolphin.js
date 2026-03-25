const { createDolphinServer } = require('../dist/server/server');
const http = require('node:http');

const app = createDolphinServer();

// Mock Express Middleware
app.use((req, res, next) => {
  req.isExpress = true;
  next();
});

app.get('/test', (ctx) => {
  ctx.json({ 
    success: true, 
    isExpress: ctx.req.isExpress 
  });
});

const PORT = 5005;
app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
  
  // Make a request immediately
  http.get(`http://127.0.0.1:${PORT}/test`, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('STATUS:', res.statusCode);
      console.log('BODY:', data);
      process.exit(0);
    });
  }).on('error', (err) => {
    console.error('Request Error:', err.message);
    process.exit(1);
  });
});
