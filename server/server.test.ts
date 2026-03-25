import { createDolphinServer } from './server';
import http from 'node:http';

describe('Dolphin Server', () => {
  let server: ReturnType<typeof createDolphinServer>;
  const PORT = 4567;

  beforeAll(() => {
    server = createDolphinServer();
    server.get('/ping', (ctx) => ctx.json({ message: 'pong' }));
    server.post('/data', (ctx) => ctx.json(ctx.body));
    server.listen(PORT);
  });

  afterAll(() => {
    server.close();
  });

  it('should respond to GET requests', (done) => {
    http.get(`http://localhost:${PORT}/ping`, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        expect(JSON.parse(data)).toEqual({ message: 'pong' });
        done();
      });
    });
  });

  it('should parse JSON bodies', (done) => {
    const req = http.request({
      hostname: 'localhost',
      port: PORT,
      path: '/data',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        expect(JSON.parse(data)).toEqual({ hello: 'world' });
        done();
      });
    });
    req.write(JSON.stringify({ hello: 'world' }));
    req.end();
  });
});
