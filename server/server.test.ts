import { createDolphinServer } from './server';
import http from 'node:http';

describe('Dolphin Server', () => {
  let server: ReturnType<typeof createDolphinServer>;
  const PORT = 4567;

  beforeAll(() => {
    server = createDolphinServer();
    
    // Basic routes
    server.get('/ping', (ctx) => ctx.json({ message: 'pong' }));
    server.post('/data', (ctx) => ctx.json(ctx.body));
    
    // Text response
    server.get('/text', (ctx) => ctx.text('Hello World'));
    
    // HTML response
    server.get('/html', (ctx) => ctx.html('<h1>Test</h1>'));
    
    // Status codes
    server.get('/status-201', (ctx) => ctx.status(201).json({ created: true }));
    server.get('/status-404', (ctx) => ctx.status(404).json({ error: 'Not Found' }));
    
    // Custom headers
    server.get('/headers', (ctx) => {
      ctx.setHeader('X-Test', 'value');
      ctx.json({ ok: true });
    });
    
    // Query parameters
    server.get('/query', (ctx) => ctx.json(ctx.query));
    
    // Route parameters
    server.get('/user/:id', (ctx) => ctx.json(ctx.params));
    server.get('/user/:id/post/:postId', (ctx) => ctx.json(ctx.params));
    
    // JSON body
    server.post('/json-body', (ctx) => ctx.json(ctx.body));
    
    // Text body
    server.post('/text-body', (ctx) => ctx.text(ctx.body));
    
    // HTML body
    server.post('/html-body', (ctx) => ctx.html(ctx.body));
    
    // Chainable methods
    server.get('/chain', (ctx) => {
      ctx.status(202).setHeader('X-Custom', 'chain').json({ chained: true });
    });
    
    server.listen(PORT);
  });

  afterAll(() => {
    server.close();
  });

  // Existing tests
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

  // Text response test
  it('should respond with text', (done) => {
    http.get(`http://localhost:${PORT}/text`, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        expect(res.headers['content-type']).toBe('text/plain');
        expect(data).toBe('Hello World');
        done();
      });
    });
  });

  // HTML response test
  it('should respond with HTML', (done) => {
    http.get(`http://localhost:${PORT}/html`, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        expect(res.headers['content-type']).toBe('text/html');
        expect(data).toBe('<h1>Test</h1>');
        done();
      });
    });
  });

  // Status code test
  it('should support status codes', (done) => {
    http.get(`http://localhost:${PORT}/status-201`, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        expect(res.statusCode).toBe(201);
        expect(JSON.parse(data)).toEqual({ created: true });
        done();
      });
    });
  });

  // Another status code test
  it('should support 404 status code', (done) => {
    http.get(`http://localhost:${PORT}/status-404`, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        expect(res.statusCode).toBe(404);
        expect(JSON.parse(data)).toEqual({ error: 'Not Found' });
        done();
      });
    });
  });

  // Custom headers test
  it('should support custom headers', (done) => {
    http.get(`http://localhost:${PORT}/headers`, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        expect(res.headers['x-test']).toBe('value');
        expect(JSON.parse(data)).toEqual({ ok: true });
        done();
      });
    });
  });

  // Query parameters test
  it('should parse query parameters', (done) => {
    http.get(`http://localhost:${PORT}/query?name=john&age=25&city=kathmandu`, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const result = JSON.parse(data);
        expect(result.name).toBe('john');
        expect(result.age).toBe('25');
        expect(result.city).toBe('kathmandu');
        done();
      });
    });
  });

  // Single route parameter test
  it('should support single route parameter', (done) => {
    http.get(`http://localhost:${PORT}/user/123`, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const result = JSON.parse(data);
        expect(result.id).toBe('123');
        done();
      });
    });
  });

  // Multiple route parameters test
  it('should support multiple route parameters', (done) => {
    http.get(`http://localhost:${PORT}/user/456/post/789`, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const result = JSON.parse(data);
        expect(result.id).toBe('456');
        expect(result.postId).toBe('789');
        done();
      });
    });
  });

  // JSON body POST test
  it('should parse JSON body in POST request', (done) => {
    const testData = { name: 'John', age: 30, city: 'Kathmandu' };
    const req = http.request({
      hostname: 'localhost',
      port: PORT,
      path: '/json-body',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const result = JSON.parse(data);
        expect(result).toEqual(testData);
        done();
      });
    });
    req.write(JSON.stringify(testData));
    req.end();
  });

  // Text body POST test
  it('should parse text body in POST request', (done) => {
    const testText = 'This is plain text body from test';
    const req = http.request({
      hostname: 'localhost',
      port: PORT,
      path: '/text-body',
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        expect(res.headers['content-type']).toBe('text/plain');
        expect(data).toBe(testText);
        done();
      });
    });
    req.write(testText);
    req.end();
  });

  // HTML body POST test
  it('should parse HTML body in POST request', (done) => {
    const testHtml = '<div><h1>Test HTML</h1><p>Content</p></div>';
    const req = http.request({
      hostname: 'localhost',
      port: PORT,
      path: '/html-body',
      method: 'POST',
      headers: { 'Content-Type': 'text/html' }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        expect(res.headers['content-type']).toBe('text/html');
        expect(data).toBe(testHtml);
        done();
      });
    });
    req.write(testHtml);
    req.end();
  });

  // Chainable methods test
  it('should support chained methods', (done) => {
    http.get(`http://localhost:${PORT}/chain`, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        expect(res.statusCode).toBe(202);
        expect(res.headers['x-custom']).toBe('chain');
        expect(JSON.parse(data)).toEqual({ chained: true });
        done();
      });
    });
  });

  // 404 Not Found test
  it('should return 404 for non-existent routes', (done) => {
    http.get(`http://localhost:${PORT}/non-existent-route-123`, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        expect(res.statusCode).toBe(404);
        expect(JSON.parse(data)).toEqual({ error: 'Not Found' });
        done();
      });
    });
  });

  // Multiple query parameters test
  it('should handle multiple query parameters', (done) => {
    http.get(`http://localhost:${PORT}/query?search=dolphin&page=2&limit=10&sort=desc`, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const result = JSON.parse(data);
        expect(result.search).toBe('dolphin');
        expect(result.page).toBe('2');
        expect(result.limit).toBe('10');
        expect(result.sort).toBe('desc');
        done();
      });
    });
  });

  // Empty query parameters test
  it('should handle empty query parameters', (done) => {
    http.get(`http://localhost:${PORT}/query`, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const result = JSON.parse(data);
        expect(result).toEqual({});
        done();
      });
    });
  });

  // Special characters in route parameters
  it('should handle special characters in route parameters', (done) => {
    http.get(`http://localhost:${PORT}/user/john_doe-123`, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const result = JSON.parse(data);
        expect(result.id).toBe('john_doe-123');
        done();
      });
    });
  });
});