export function generateClientJS(routes: any[], platform?: string): string {
  const coreCode = `
class DolphinClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
    this.baseUrl = this.baseUrl.replace(/\\/$/, '');
    this.tokenKey = 'dolphin_token';
    this.sseConnection = null;
    this.wsConnection = null;
    this.realtimeCallbacks = new Set();
    this._initSDK();
  }

  setToken(token) {
    if (typeof window !== 'undefined') {
      if (token) {
        window.localStorage.setItem(this.tokenKey, token);
      } else {
        window.localStorage.removeItem(this.tokenKey);
      }
    }
    this._token = token;
  }

  getToken() {
    if (this._token) return this._token;
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem(this.tokenKey);
    }
    return null;
  }

  async _request(method, path, body, options = {}) {
    const url = this.baseUrl + path;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    }

    const fetchConstructor = (typeof window !== 'undefined' ? window.fetch : (typeof globalThis !== 'undefined' ? globalThis.fetch : null));
    if (!fetchConstructor) {
      throw new Error('[DolphinClient] Fetch is not supported in this environment');
    }

    const response = await fetchConstructor(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      ...options
    });

    if (response.status === 401) {
      this.setToken(null);
    }

    if (!response.ok) {
      let err;
      try {
        const json = await response.json();
        err = new Error(json.message || 'Request failed');
        err.status = response.status;
        err.errors = json.errors;
      } catch {
        err = new Error('Request failed');
        err.status = response.status;
      }
      throw err;
    }

    // Handle 204 No Content
    if (response.status === 204) return null;

    return response.json();
  }

  connectRealtime(onMessage, topics = []) {
    this.realtimeCallbacks.add(onMessage);
    const deviceId = 'web_' + Math.random().toString(36).substring(2, 10);
    const token = this.getToken();
    const tokenParam = token ? '&token=' + encodeURIComponent(token) : '';
    const topicsArr = Array.isArray(topics) ? topics : [topics];
    
    let ws = null;
    let queuedSubs = [];
    const activeSubs = new Set(topicsArr);

    const sendMsg = (msg) => {
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify(msg));
      } else {
        queuedSubs.push(msg);
      }
    };

    const subscribe = (topic) => {
      activeSubs.add(topic);
      sendMsg({ type: 'sub', topic });
    };

    const unsubscribe = (topic) => {
      activeSubs.delete(topic);
      sendMsg({ type: 'unsub', topic });
    };

    // Pre-queue initial subscriptions
    topicsArr.forEach(topic => {
      queuedSubs.push({ type: 'sub', topic });
    });

    const wsConstructor = (typeof window !== 'undefined' ? window.WebSocket : (typeof globalThis !== 'undefined' ? globalThis.WebSocket : null));
    if (wsConstructor) {
      const wsProto = this.baseUrl.startsWith('https') ? 'wss://' : 'ws://';
      const wsUrl = this.baseUrl.replace(/^https?:\\/\\//, wsProto) + '/realtime?deviceId=' + deviceId + tokenParam;
      
      try {
        ws = new wsConstructor(wsUrl);
        this.wsConnection = ws;
        
        ws.onopen = () => {
          console.log('[DolphinClient] WebSocket connected');
          // Send all queued subscriptions
          while (queuedSubs.length > 0) {
            const msg = queuedSubs.shift();
            ws.send(JSON.stringify(msg));
          }
        };
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            const payload = data.payload !== undefined ? data.payload : data;
            this.realtimeCallbacks.forEach(cb => cb(payload));
          } catch {}
        };
        
        ws.onerror = () => {
          this._fallbackToSSE(activeSubs);
        };
        
        ws.onclose = () => {
          this._fallbackToSSE(activeSubs);
        };

        const closeFn = () => {
          this.realtimeCallbacks.delete(onMessage);
          if (ws) {
            ws.close();
          }
        };
        closeFn.subscribe = subscribe;
        closeFn.unsubscribe = unsubscribe;
        return closeFn;
      } catch (err) {
        this._fallbackToSSE(activeSubs);
      }
    } else {
      this._fallbackToSSE(activeSubs);
    }

    const fallbackCloseFn = () => {
      this.realtimeCallbacks.delete(onMessage);
      if (this.sseConnection) {
        this.sseConnection.close();
      }
    };
    fallbackCloseFn.subscribe = subscribe;
    fallbackCloseFn.unsubscribe = unsubscribe;
    return fallbackCloseFn;
  }

  _fallbackToSSE(activeSubs) {
    if (this.sseConnection || this.wsConnection?.readyState === 1) return;
    
    const sseConstructor = (typeof window !== 'undefined' ? window.EventSource : (typeof globalThis !== 'undefined' ? globalThis.EventSource : null));
    if (!sseConstructor) {
      console.warn('[DolphinClient] EventSource is not supported in this environment');
      return;
    }

    console.log('[DolphinClient] Falling back to SSE (Server-Sent Events)');
    const token = this.getToken();
    const tokenParam = token ? '?token=' + encodeURIComponent(token) : '';
    const topicsList = activeSubs && activeSubs.size > 0 ? '&topics=' + encodeURIComponent(Array.from(activeSubs).join(',')) : '';
    const sseUrl = this.baseUrl + '/realtime/sse' + tokenParam + topicsList;
    const sse = new sseConstructor(sseUrl);
    this.sseConnection = sse;
    
    sse.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const payload = data.payload !== undefined ? data.payload : data;
        this.realtimeCallbacks.forEach(cb => cb(payload));
      } catch {}
    };
  }
}
`;

  const methodsCode: string[] = [];

  for (const r of routes) {
    const segments = r.path.split('/').filter(Boolean);
    if (segments.length === 0) continue;

    const cleanSegments: string[] = [];
    const paramsList: string[] = [];
    for (const seg of segments) {
      if (seg.startsWith(':')) {
        paramsList.push(seg.slice(1));
      } else {
        let clean = seg.replace(/[^a-zA-Z0-9_]/g, '_');
        if (/^[0-9]/.test(clean)) {
          clean = '_' + clean;
        }
        cleanSegments.push(clean);
      }
    }

    let funcName = r.method.toLowerCase();
    const lastIsParam = segments[segments.length - 1].startsWith(':');
    
    if (lastIsParam) {
      if (r.method === 'GET') funcName = 'getOne';
    } else {
      if (r.method === 'GET') funcName = 'get';
    }

    let nsSegments = [...cleanSegments];
    if (!lastIsParam && cleanSegments.length > 0) {
      const lastSeg = cleanSegments[cleanSegments.length - 1];
      if (['login', 'register', 'logout', 'refresh', 'signup'].includes(lastSeg)) {
        funcName = lastSeg;
        nsSegments.pop();
      }
    }

    const nsPath = nsSegments.join('.');
    const fullPathToInit = nsSegments.map((_, i) => `client.${nsSegments.slice(0, i + 1).join('.')}`).map(p => `${p} = ${p} || {};`).join('\n');

    const jsArgs: string[] = [];
    let runtimePathExpr = '`' + r.path.replace(/:([a-zA-Z0-9_]+)/g, (_: string, paramName: string) => {
      jsArgs.push(paramName);
      return `\${${paramName}}`;
    }) + '`';

    if (r.method === 'POST' || r.method === 'PUT' || r.method === 'PATCH') {
      jsArgs.push('body');
    }
    jsArgs.push('options');

    const argsStr = jsArgs.join(', ');
    const bodyArg = (r.method === 'POST' || r.method === 'PUT' || r.method === 'PATCH') ? 'body' : 'undefined';

    methodsCode.push(`
    // Route: ${r.method} ${r.path}
    ${fullPathToInit}
    client.${nsPath ? nsPath + '.' : ''}${funcName} = function(${argsStr}) {
      return this._request('${r.method}', ${runtimePathExpr}, ${bodyArg}, options);
    }.bind(this);
`);
  }

  const isNative = platform === 'native';

  const nativeSyncCode = `
class DolphinNativeSync {
  constructor(baseUrl, deviceId, options = {}) {
    this.client = new DolphinClient(baseUrl);
    this.client.setToken(options.token || null);
    this.deviceId = deviceId || 'native_device_' + Math.random().toString(36).substring(2, 10);
    this.app = null;
    this.stopFn = null;
  }

  sync(app) {
    this.app = app;
    
    // Auto sync reactive routes topics to app states
    this.stopFn = this.client.connectRealtime((msg) => {
      if (!this.app) return;

      // ─── Intercom State Syncing ───
      if (msg.topic === 'intercom/calls') {
        if (msg.action === 'invite') {
          this.app.state('call_state', 'RINGING');
          this.app.state('active_call', msg.data);
        } else if (msg.action === 'accept') {
          this.app.state('call_state', 'CONNECTED');
        } else if (msg.action === 'end') {
          this.app.state('call_state', 'ENDED');
          this.app.state('active_call', null);
        }
        return;
      }

      // ─── Standard CRUD State Syncing ───
      const stateName = msg.topic.split('/').pop();
      let currentData = this.app.getState(stateName);
      
      // Auto initialize state if empty or undefined
      if (currentData === undefined) {
        currentData = [];
      }

      if (Array.isArray(currentData)) {
        if (msg.action === 'create') {
          currentData.push(msg.data);
        } else if (msg.action === 'update') {
          currentData = currentData.map(item => item.id === msg.data.id ? msg.data : item);
        } else if (msg.action === 'delete') {
          currentData = currentData.filter(item => item.id !== msg.data.id);
        }
        this.app.state(stateName, currentData);
      } else if (typeof currentData === 'object' && currentData !== null) {
        if (msg.action === 'update') {
          this.app.state(stateName, { ...currentData, ...msg.data });
        }
      }
    }, ['api/#', 'intercom/calls']);
  }

  disconnect() {
    if (this.stopFn) {
      this.stopFn();
      this.stopFn = null;
    }
  }
}
`;

  const isESM = platform === 'react' || platform === 'esm';

  let generatedCode = '';
  if (isESM) {
    generatedCode = `
${coreCode}

DolphinClient.prototype._initSDK = function() {
  const client = this;
  ${methodsCode.join('\n')}
};

const client = new DolphinClient();

export { DolphinClient, client };
`;
  } else {
    generatedCode = `
(function(global) {
  ${coreCode}

  DolphinClient.prototype._initSDK = function() {
    const client = this;
    ${methodsCode.join('\n')}
  };

  const client = new DolphinClient();

  ${isNative ? nativeSyncCode : ''}

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { client, DolphinClient${isNative ? ', DolphinNativeSync' : ''} };
  }
  
  if (typeof global !== 'undefined') {
    global.client = client;
    global.DolphinClient = DolphinClient;
    ${isNative ? 'global.DolphinNativeSync = DolphinNativeSync;' : ''}
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : (typeof self !== 'undefined' ? self : this))));
`;
  }

  return generatedCode;
}

export function generateClientDTS(routes: any[], platform?: string): string {
  const tree: any = {};

  for (const r of routes) {
    const segments = r.path.split('/').filter(Boolean);
    if (segments.length === 0) continue;

    const cleanSegments: string[] = [];
    const paramsList: string[] = [];
    for (const seg of segments) {
      if (seg.startsWith(':')) {
        paramsList.push(seg.slice(1));
      } else {
        let clean = seg.replace(/[^a-zA-Z0-9_]/g, '_');
        if (/^[0-9]/.test(clean)) {
          clean = '_' + clean;
        }
        cleanSegments.push(clean);
      }
    }

    let funcName = r.method.toLowerCase();
    const lastIsParam = segments[segments.length - 1].startsWith(':');
    
    if (lastIsParam) {
      if (r.method === 'GET') funcName = 'getOne';
    } else {
      if (r.method === 'GET') funcName = 'get';
    }

    let nsSegments = [...cleanSegments];
    if (!lastIsParam && cleanSegments.length > 0) {
      const lastSeg = cleanSegments[cleanSegments.length - 1];
      if (['login', 'register', 'logout', 'refresh', 'signup'].includes(lastSeg)) {
        funcName = lastSeg;
        nsSegments.pop();
      }
    }

    let current = tree;
    for (const seg of nsSegments) {
      current[seg] = current[seg] || {};
      current = current[seg];
    }

    const methodArgs: string[] = [];
    for (const p of paramsList) {
      methodArgs.push(`${p}: string | number`);
    }
    if (r.method === 'POST' || r.method === 'PUT' || r.method === 'PATCH') {
      methodArgs.push('body?: any');
    }
    methodArgs.push('options?: any');

    const signature = `(${methodArgs.join(', ')}): Promise<any>`;
    current[funcName] = signature;
  }

  function serializeTree(node: any, indent: string = '  '): string {
    let out = '{\n';
    for (const [key, val] of Object.entries(node)) {
      if (typeof val === 'string') {
        out += `${indent}  ${key}${val};\n`;
      } else {
        out += `${indent}  ${key}: ${serializeTree(val, indent + '  ')};\n`;
      }
    }
    out += `${indent}}`;
    return out;
  }

  const dtsBody = serializeTree(tree, '');
  const isNative = platform === 'native';

  const nativeSyncDTS = `
export class DolphinNativeSync {
  client: DolphinClient;
  deviceId: string;
  app: any;
  stopFn: any;
  constructor(baseUrl: string, deviceId?: string, options?: { token?: string | null });
  sync(app: any): void;
  disconnect(): void;
}
`;

  const dtsCode = `
export class DolphinClient {
  baseUrl: string;
  tokenKey: string;
  sseConnection: any;
  wsConnection: any;
  realtimeCallbacks: Set<Function>;
  constructor(baseUrl?: string);
  setToken(token: string | null): void;
  getToken(): string | null;
  connectRealtime(onMessage: (data: any) => void): () => void;
}

export interface DolphinClient ${dtsBody}

export const client: DolphinClient;

${isNative ? nativeSyncDTS : ''}
`;

  return dtsCode.trim();
}

