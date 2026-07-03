export {};
/**
 * client.test.ts — DolphinClient को लागि Jest unit tests
 *
 * Test गरिएका कुराहरू:
 *  - DolphinClient constructor + URL parsing
 *  - setToken / storage
 *  - APIHandler (proxy path building, request, timeout, 401 auto-refresh)
 *  - AuthHandler (login, logout, refresh, 2FA)
 *  - _matchTopic  (MQTT wildcards)
 *  - pub/sub  (subscribe / unsubscribe / publish / offline queue)
 *  - pubFile  (chunked file upload)
 *  - _uint8ToBase64
 *  - DolphinStore  (collection, where, orderBy, remote update)
 *  - disconnect
 */

// Custom jest-esm-strip-transform.cjs ले automatically ESM export line strip गर्छ
// त्यसैले सिधै client.js import गर्न मिल्छ — client.cjs manually बनाउनु पर्दैन
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { DolphinClient } = require('../scripts/client.js');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a fake WebSocket that triggers onopen immediately */
function makeFakeWS(overrides: Partial<WebSocket> = {}): any {
  const ws: any = {
    readyState: 1 /* OPEN */,
    sent: [] as string[],
    send(msg: string) { this.sent.push(msg); },
    close() { if (this.onclose) this.onclose(); },
    onopen: null as any,
    onmessage: null as any,
    onclose: null as any,
    onerror: null as any,
    ...overrides,
  };
  return ws;
}

/** Inject a fake WebSocket constructor into global scope */
function injectFakeWS(ws: any) {
  (global as any).WebSocket = class {
    static OPEN = 1;
    readyState = ws.readyState;
    sent = ws.sent;
    send = ws.send.bind(ws);
    close = ws.close.bind(ws);
    set onopen(v: any)    { ws.onopen = v; }
    get onopen()          { return ws.onopen; }
    set onmessage(v: any) { ws.onmessage = v; }
    get onmessage()       { return ws.onmessage; }
    set onclose(v: any)   { ws.onclose = v; }
    get onclose()         { return ws.onclose; }
    set onerror(v: any)   { ws.onerror = v; }
    get onerror()         { return ws.onerror; }
    constructor() { setTimeout(() => ws.onopen && ws.onopen(), 0); }
  };
}

/** Build a fake fetch that resolves with the given body */
function makeFetch(status: number, body: any, contentType = 'application/json') {
  return jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => contentType },
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Constructor + URL parsing
// ─────────────────────────────────────────────────────────────────────────────

describe('DolphinClient — constructor', () => {
  test('http:// URL parse गर्छ', () => {
    const c = new DolphinClient('http://localhost:3000');
    expect(c.httpUrl).toBe('http://localhost:3000');
    expect(c.host).toBe('localhost:3000');
  });

  test('https:// URL parse गर्छ', () => {
    const c = new DolphinClient('https://example.com');
    expect(c.httpUrl).toBe('https://example.com');
  });

  test('trailing slash हटाउँछ', () => {
    const c = new DolphinClient('http://localhost:3000/');
    expect(c.host).toBe('localhost:3000');
  });

  test('default options सेट हुन्छन्', () => {
    const c = new DolphinClient('http://localhost:3000');
    expect(c.options.timeout).toBe(15000);
    expect(c.options.chunkSize).toBe(65536);
    expect(c.options.maxReconnect).toBe(5);
    expect(c.options.autoRefreshToken).toBe(true);
  });

  test('custom options override हुन्छन्', () => {
    const c = new DolphinClient('http://localhost:3000', 'dev1', { timeout: 5000, maxReconnect: 2 });
    expect(c.options.timeout).toBe(5000);
    expect(c.options.maxReconnect).toBe(2);
  });

  test('deviceId custom सेट हुन्छ', () => {
    const c = new DolphinClient('http://localhost:3000', 'myDevice');
    expect(c.deviceId).toBe('myDevice');
  });

  test('deviceId auto-generate हुन्छ जब दिइँदैन', () => {
    const c = new DolphinClient('http://localhost:3000');
    expect(c.deviceId).toMatch(/^web_/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. setToken
// ─────────────────────────────────────────────────────────────────────────────

describe('DolphinClient — setToken', () => {
  let c: any;
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    c = new DolphinClient('http://localhost:3000');
    c.storage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    };
  });

  test('token set र storage मा save गर्छ', () => {
    c.setToken('abc123');
    expect(c.accessToken).toBe('abc123');
    expect(store['dolphin_token']).toBe('abc123');
  });

  test('null दिँदा token clear हुन्छ', () => {
    c.setToken('abc123');
    c.setToken(null);
    expect(c.accessToken).toBeNull();
    expect(store['dolphin_token']).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. APIHandler — proxy path building
// ─────────────────────────────────────────────────────────────────────────────

describe('APIHandler — proxy paths', () => {
  let c: any;

  beforeEach(() => {
    c = new DolphinClient('http://localhost:3000');
    (global as any).fetch = makeFetch(200, { ok: true });
  });

  afterEach(() => { delete (global as any).fetch; });

  test('api.users.get() → /users मा GET request', async () => {
    await c.api.users.get();
    const url = (global as any).fetch.mock.calls[0][0];
    expect(url).toBe('http://localhost:3000/users');
  });

  test('api.users.posts.get() → /users/posts', async () => {
    await c.api.users.posts.get();
    const url = (global as any).fetch.mock.calls[0][0];
    expect(url).toBe('http://localhost:3000/users/posts');
  });

  test('api.users.post(body) → POST /users', async () => {
    await c.api.users.post({ name: 'Ram' });
    const [url, opts] = (global as any).fetch.mock.calls[0];
    expect(url).toBe('http://localhost:3000/users');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({ name: 'Ram' });
  });

  test('api.users.del() → DELETE /users', async () => {
    await c.api.users.del();
    const [, opts] = (global as any).fetch.mock.calls[0];
    expect(opts.method).toBe('DELETE');
  });

  test('Authorization header token हुँदा लाग्छ', async () => {
    c.setToken('tok99');
    await c.api.me.get();
    const [, opts] = (global as any).fetch.mock.calls[0];
    expect(opts.headers['Authorization']).toBe('Bearer tok99');
  });

  test('autoBroadcast — POST request पछि realtime publish गर्छ', async () => {
    const cAuto = new DolphinClient('http://localhost:3000', 'dev', { autoBroadcast: true });
    cAuto.publish = jest.fn();
    (global as any).fetch = makeFetch(200, { data: 'success' });
    
    await cAuto.api.request('POST', '/api/users', { name: 'Ram' });
    
    expect(cAuto.publish).toHaveBeenCalledWith('api/users', {
      method: 'POST',
      payload: { name: 'Ram' },
      result: { data: 'success' }
    });
  });

  test('hookless auth — API response मा accessToken आउँदा आफैँ सेभ गर्छ', async () => {
    const cAuth = new DolphinClient('http://localhost:3000');
    (global as any).fetch = makeFetch(200, { 
      accessToken: 'hookless-token-123', 
      user: { id: 1, name: 'Sita' } 
    });
    
    // Using generic API handler instead of auth.login
    await cAuth.api.request('POST', '/api/auth/login', { email: 'a@b.com', password: '123' });
    
    expect(cAuth.accessToken).toBe('hookless-token-123');
    expect(cAuth.auth.user).toEqual({ id: 1, name: 'Sita' });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. APIHandler — request timeout
// ─────────────────────────────────────────────────────────────────────────────

describe('APIHandler — timeout', () => {
  test('AbortError → 408 थ्रो गर्छ', async () => {
    const c = new DolphinClient('http://localhost:3000', '', { timeout: 100 });
    (global as any).fetch = jest.fn().mockRejectedValue(
      Object.assign(new Error('abort'), { name: 'AbortError' })
    );
    await expect(c.api.request('GET', '/slow', null)).rejects.toMatchObject({ status: 408 });
    delete (global as any).fetch;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. APIHandler — 401 auto-refresh
// ─────────────────────────────────────────────────────────────────────────────

describe('APIHandler — 401 auto-refresh', () => {
  test('401 मा token refresh गरेर retry गर्छ', async () => {
    const c = new DolphinClient('http://localhost:3000');
    let callCount = 0;
    (global as any).fetch = jest.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // First call → 401
        return Promise.resolve({
          ok: false, status: 401,
          headers: { get: () => 'application/json' },
          json: async () => ({ error: 'Unauthorized' }),
        });
      }
      if (callCount === 2) {
        // Refresh call → new token
        return Promise.resolve({
          ok: true, status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({ accessToken: 'newTok' }),
        });
      }
      // Retry call → success
      return Promise.resolve({
        ok: true, status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({ data: 'ok' }),
      });
    });

    const res = await c.api.request('GET', '/protected');
    expect(res).toEqual({ data: 'ok' });
    expect(c.accessToken).toBe('newTok');
    delete (global as any).fetch;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. AuthHandler
// ─────────────────────────────────────────────────────────────────────────────

describe('AuthHandler', () => {
  let c: any;

  beforeEach(() => {
    c = new DolphinClient('http://localhost:3000');
  });

  afterEach(() => { delete (global as any).fetch; });

  test('login — token र user set गर्छ', async () => {
    (global as any).fetch = makeFetch(200, { accessToken: 'tok1', user: { id: 1, email: 'a@b.com' } });
    await c.auth.login('a@b.com', 'pass');
    expect(c.accessToken).toBe('tok1');
    expect(c.auth.user).toEqual({ id: 1, email: 'a@b.com' });
  });

  test('logout — token clear गर्छ', async () => {
    (global as any).fetch = makeFetch(200, {});
    c.setToken('tok1');
    await c.auth.logout();
    expect(c.accessToken).toBeNull();
    expect(c.auth.user).toBeNull();
  });

  test('register — POST /api/auth/register', async () => {
    (global as any).fetch = makeFetch(200, { success: true });
    await c.auth.register({ email: 'new@b.com', password: '123456' });
    const [url, opts] = (global as any).fetch.mock.calls[0];
    expect(url).toContain('/api/auth/register');
    expect(opts.method).toBe('POST');
  });

  test('me — user update गर्छ', async () => {
    (global as any).fetch = makeFetch(200, { success: true, data: { id: 2 } });
    await c.auth.me();
    expect(c.auth.user).toEqual({ id: 2 });
  });

  test('verify2FA — token set गर्छ', async () => {
    (global as any).fetch = makeFetch(200, { accessToken: 'tok2fa', user: { id: 3 } });
    c.auth.user = { email: 'x@y.com' };
    await c.auth.verify2FA('123456');
    expect(c.accessToken).toBe('tok2fa');
    expect(c.auth.user).toEqual({ id: 3 });
  });

  test('forgotPassword — POST /api/auth/forgot-password', async () => {
    (global as any).fetch = makeFetch(200, { success: true });
    await c.auth.forgotPassword('test@example.com');
    const [url] = (global as any).fetch.mock.calls[0];
    expect(url).toContain('/api/auth/forgot-password');
  });

  test('resetPassword — POST /api/auth/reset-password', async () => {
    (global as any).fetch = makeFetch(200, { success: true });
    await c.auth.resetPassword('reset-tok', 'newPass');
    const [url, opts] = (global as any).fetch.mock.calls[0];
    expect(url).toContain('/api/auth/reset-password');
    expect(JSON.parse(opts.body)).toEqual({ token: 'reset-tok', newPassword: 'newPass' });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. _matchTopic — MQTT wildcard matching
// ─────────────────────────────────────────────────────────────────────────────

describe('_matchTopic — MQTT wildcards', () => {
  let c: any;
  beforeAll(() => { c = new DolphinClient('http://localhost:3000'); });

  const cases: [string, string, boolean][] = [
    ['sensor/temp', 'sensor/temp', true],
    ['sensor/+',   'sensor/temp', true],
    ['sensor/+',   'sensor/humid', true],
    ['sensor/+',   'sensor/a/b', false],
    ['#',          'anything/deep/path', true],
    ['sensor/#',   'sensor/a/b/c', true],
    ['sensor/#',   'other/topic', false],
    ['a/b/c',      'a/b/d', false],
    ['a/b',        'a/b/c', false],
  ];

  test.each(cases)('pattern="%s" topic="%s" → %s', (pattern, topic, expected) => {
    expect(c._matchTopic(pattern, topic)).toBe(expected);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Pub/Sub — subscribe / unsubscribe / publish
// ─────────────────────────────────────────────────────────────────────────────

describe('Pub/Sub', () => {
  let c: any;
  let ws: any;

  beforeEach(() => {
    ws = makeFakeWS();
    injectFakeWS(ws);
    c = new DolphinClient('http://localhost:3000');
  });

  afterEach(() => { delete (global as any).WebSocket; });

  test('subscribe — handler register हुन्छ', () => {
    const cb = jest.fn();
    c.subscribe('news', cb);
    expect(c.handlers.has('news')).toBe(true);
  });

  test('subscribe — WS मा sub message पठाउँछ (जब connected)', async () => {
    await c.connect();
    const cb = jest.fn();
    c.subscribe('chat', cb);
    const subMsg = ws.sent.find((s: string) => {
      try { return JSON.parse(s).type === 'sub'; } catch { return false; }
    });
    expect(subMsg).toBeDefined();
  });

  test('unsubscribe — handler हटाउँछ', () => {
    const cb = jest.fn();
    c.subscribe('room', cb);
    c.unsubscribe('room', cb);
    expect(c.handlers.has('room')).toBe(false);
  });

  test('publish — WS मा message पठाउँछ', async () => {
    await c.connect();
    c.publish('topic1', { hello: 'world' });
    const pub = ws.sent.find((s: string) => {
      try { const p = JSON.parse(s); return p.topic === 'topic1'; } catch { return false; }
    });
    expect(pub).toBeDefined();
    expect(JSON.parse(pub!).payload).toEqual({ hello: 'world' });
  });

  test('_handleMessage — topic callback fire हुन्छ', () => {
    const cb = jest.fn();
    c.subscribe('data/sensor', cb);
    c._handleMessage(JSON.stringify({ topic: 'data/sensor', payload: { v: 42 } }));
    expect(cb).toHaveBeenCalledWith({ v: 42 }, 'data/sensor');
  });

  test('+ wildcard — matching topic मा callback fire हुन्छ', () => {
    const cb = jest.fn();
    c.subscribe('data/+', cb);
    c._handleMessage(JSON.stringify({ topic: 'data/temp', payload: 25 }));
    expect(cb).toHaveBeenCalledWith(25, 'data/temp');
  });

  test('# wildcard — सबै subtopic मा callback fire हुन्छ', () => {
    const cb = jest.fn();
    c.subscribe('data/#', cb);
    c._handleMessage(JSON.stringify({ topic: 'data/a/b/c', payload: 99 }));
    expect(cb).toHaveBeenCalledWith(99, 'data/a/b/c');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. Offline queue
// ─────────────────────────────────────────────────────────────────────────────

describe('Offline queue', () => {
  test('socket नभएको बेला message queue मा जान्छ', () => {
    const c = new DolphinClient('http://localhost:3000');
    c.socket = null;
    c.publish('topic', { x: 1 });
    expect(c._offlineQueue.length).toBe(1);
  });

  test('connect भएपछि queue flush हुन्छ', async () => {
    const ws = makeFakeWS();
    injectFakeWS(ws);
    const c = new DolphinClient('http://localhost:3000');
    c._offlineQueue.push(JSON.stringify({ topic: 'q', payload: 'hi' }));
    await c.connect();
    expect(c._offlineQueue.length).toBe(0);
    delete (global as any).WebSocket;
  });

  test('100 भन्दा बढी queue हुँदैन', () => {
    const c = new DolphinClient('http://localhost:3000');
    c.socket = null;
    for (let i = 0; i < 150; i++) c.publish('t', i);
    expect(c._offlineQueue.length).toBe(100);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. pubFile — chunked file upload
// ─────────────────────────────────────────────────────────────────────────────

describe('pubFile — chunked upload', () => {
  let c: any;
  let ws: any;

  beforeEach(async () => {
    ws = makeFakeWS();
    injectFakeWS(ws);
    c = new DolphinClient('http://localhost:3000', '', { chunkSize: 4 });
    await c.connect();
  });

  afterEach(() => { delete (global as any).WebSocket; });

  test('FILE_UPLOAD_START + CHUNK + DONE messages पठाउँछ', async () => {
    const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]); // 8 bytes → 2 chunks of 4
    await c.pubFile('file1', data, 'test.bin');

    const msgs = ws.sent.map((s: string) => JSON.parse(s));
    const start = msgs.find((m: any) => m.type === 'FILE_UPLOAD_START');
    const chunks = msgs.filter((m: any) => m.type === 'FILE_UPLOAD_CHUNK');
    const done  = msgs.find((m: any) => m.type === 'FILE_UPLOAD_DONE');

    expect(start).toBeDefined();
    expect(start.fileId).toBe('file1');
    expect(start.totalChunks).toBe(2);
    expect(chunks).toHaveLength(2);
    expect(done).toBeDefined();
  });

  test('onProgress callback सही percent call हुन्छ', async () => {
    const data = new Uint8Array([1, 2, 3, 4]);
    const progress: number[] = [];
    await c.pubFile('file2', data, 'tiny.bin', (p: number) => progress.push(p));
    expect(progress).toContain(100);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. _uint8ToBase64
// ─────────────────────────────────────────────────────────────────────────────

describe('_uint8ToBase64', () => {
  let c: any;
  beforeAll(() => { c = new DolphinClient('http://localhost:3000'); });

  test('empty array → empty string', () => {
    expect(c._uint8ToBase64(new Uint8Array([]))).toBe('');
  });

  test('known bytes → correct base64', () => {
    // [72, 101, 108, 108, 111] = "Hello"
    const result = c._uint8ToBase64(new Uint8Array([72, 101, 108, 108, 111]));
    expect(result).toBe('SGVsbG8=');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 12. Signaling handlers
// ─────────────────────────────────────────────────────────────────────────────

describe('Signaling handlers', () => {
  let c: any;

  beforeEach(() => {
    c = new DolphinClient('http://localhost:3000', 'deviceA');
  });

  test('onSignal — handler register र fire हुन्छ', () => {
    const handler = jest.fn();
    c.onSignal(handler);
    c._handleMessage(JSON.stringify({
      msgId: 'm1', type: 'offer', from: 'deviceB', to: 'deviceA', data: {}, timestamp: Date.now()
    }));
    expect(handler).toHaveBeenCalled();
  });

  test('offSignal — handler हटाइन्छ', () => {
    const handler = jest.fn();
    c.onSignal(handler);
    c.offSignal(handler);
    c._handleMessage(JSON.stringify({
      msgId: 'm2', type: 'offer', from: 'deviceB', to: 'deviceA', data: {}, timestamp: Date.now()
    }));
    expect(handler).not.toHaveBeenCalled();
  });

  test('onFileAvailable — handler register हुन्छ', () => {
    const handler = jest.fn();
    c.onFileAvailable(handler);
    c._handleMessage(JSON.stringify({ type: 'FILE_AVAILABLE', fileId: 'f1', name: 'img.png', size: 1024, totalChunks: 1, chunkSize: 65536 }));
    expect(handler).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 13. DolphinStore — collection management
// ─────────────────────────────────────────────────────────────────────────────

describe('DolphinStore', () => {
  let c: any;

  beforeEach(() => {
    c = new DolphinClient('http://localhost:3000');
    // Stub fetch to return empty list (store does HTTP GET)
    (global as any).fetch = makeFetch(200, []);
  });

  afterEach(() => { delete (global as any).fetch; });

  test('store.users access → collection object return गर्छ', () => {
    const col = c.store.users;
    expect(col).toBeDefined();
    expect(col.loading).toBe(true);
    expect(col.items).toEqual([]);
  });

  test('getSnapshot — default state return गर्छ जब collection छैन', () => {
    const snap = c.store.getSnapshot('nonexistent');
    expect(snap).toEqual({ items: [], loading: false, error: null, success: false });
  });

  test('subscribe listener — notify हुन्छ', async () => {
    const listener = jest.fn();
    const unsub = c.store.subscribe(listener);
    // Trigger a remote update manually
    c.store.data.set('items', { _rawItems: [{ id: 1 }], items: [], loading: false, success: true, error: null, _filter: null, _sort: null });
    c.store._applyTransform(c.store.data.get('items'));
    await Promise.resolve();
    expect(listener).toHaveBeenCalled();
    unsub();
  });

  test('_handleRemoteUpdate — create: item थपिन्छ', () => {
    c.store.data.set('posts', {
      _rawItems: [{ _id: 'a', title: 'First' }],
      items: [], loading: false, success: true, error: null, _filter: null, _sort: null,
    });
    c.store._handleRemoteUpdate('posts', { type: 'create', data: { _id: 'b', title: 'Second' } });
    const col = c.store.data.get('posts');
    expect(col._rawItems).toHaveLength(2);
  });

  test('_handleRemoteUpdate — update: item update हुन्छ', () => {
    c.store.data.set('posts', {
      _rawItems: [{ _id: 'a', title: 'Old' }],
      items: [], loading: false, success: true, error: null, _filter: null, _sort: null,
    });
    c.store._handleRemoteUpdate('posts', { type: 'update', data: { _id: 'a', title: 'New' } });
    expect(c.store.data.get('posts')._rawItems[0].title).toBe('New');
  });

  test('_handleRemoteUpdate — delete: item हटाइन्छ', () => {
    c.store.data.set('posts', {
      _rawItems: [{ _id: 'a' }, { _id: 'b' }],
      items: [], loading: false, success: true, error: null, _filter: null, _sort: null,
    });
    c.store._handleRemoteUpdate('posts', { type: 'delete', data: { _id: 'a' } });
    expect(c.store.data.get('posts')._rawItems).toHaveLength(1);
  });

  test('where filter लाग्छ', () => {
    const col: any = {
      _rawItems: [{ id: 1, active: true }, { id: 2, active: false }],
      items: [], loading: false, success: true, error: null, _filter: null, _sort: null,
      where: (fn: any) => { col._filter = fn; c.store._applyTransform(col); return col; },
      orderBy: () => col,
      reset: () => col,
    };
    c.store.data.set('filter_test', col);
    col.where((item: any) => item.active);
    expect(col.items).toHaveLength(1);
    expect(col.items[0].id).toBe(1);
  });

  test('orderBy sort लाग्छ', () => {
    const col: any = {
      _rawItems: [{ id: 2 }, { id: 1 }, { id: 3 }],
      items: [], loading: false, success: true, error: null, _filter: null, _sort: null,
      where: () => col,
      orderBy: (key: string, dir: string = 'asc') => {
        col._sort = { key, direction: dir };
        c.store._applyTransform(col);
        return col;
      },
      reset: () => col,
    };
    c.store.data.set('sort_test', col);
    col.orderBy('id', 'asc');
    expect(col.items.map((i: any) => i.id)).toEqual([1, 2, 3]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 14. disconnect
// ─────────────────────────────────────────────────────────────────────────────

describe('disconnect', () => {
  test('socket null गर्छ र auto-reconnect हुँदैन', async () => {
    const ws = makeFakeWS();
    injectFakeWS(ws);
    const c = new DolphinClient('http://localhost:3000');
    await c.connect();
    c.disconnect();
    expect(c.socket).toBeNull();
    delete (global as any).WebSocket;
  });
});
