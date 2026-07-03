export function generateClientJS(routes: any[]): string {
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

    const fetchOpts = {
      method,
      headers,
      ...options
    };

    if (body) {
      fetchOpts.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchOpts);
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const err = new Error(errData.message || 'Request failed');
      err.status = response.status;
      err.errors = errData.errors;
      throw err;
    }

    return response.json();
  }

  connectRealtime(onMessage) {
    this.realtimeCallbacks.add(onMessage);
    const deviceId = 'web_' + Math.random().toString(36).substring(2, 10);
    const token = this.getToken();
    const tokenParam = token ? '&token=' + encodeURIComponent(token) : '';
    
    // Attempt WebSocket first if browser supports it
    if (typeof window !== 'undefined' && window.WebSocket) {
      const wsProto = this.baseUrl.startsWith('https') ? 'wss://' : 'ws://';
      const wsUrl = this.baseUrl.replace(/^https?:\\/\\//, wsProto) + '/realtime?deviceId=' + deviceId + tokenParam;
      
      try {
        const ws = new window.WebSocket(wsUrl);
        this.wsConnection = ws;
        
        ws.onopen = () => {
          console.log('[DolphinClient] WebSocket connected');
        };
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.realtimeCallbacks.forEach(cb => cb(data));
          } catch {}
        };
        
        ws.onerror = () => {
          this._fallbackToSSE();
        };
        
        ws.onclose = () => {
          this._fallbackToSSE();
        };
        
        return () => {
          this.realtimeCallbacks.delete(onMessage);
          if (this.wsConnection) {
            this.wsConnection.close();
          }
        };
      } catch (err) {
        this._fallbackToSSE();
      }
    } else {
      this._fallbackToSSE();
    }

    return () => {
      this.realtimeCallbacks.delete(onMessage);
      if (this.sseConnection) {
        this.sseConnection.close();
      }
    };
  }

  _fallbackToSSE() {
    if (this.sseConnection || this.wsConnection?.readyState === 1) return;
    
    console.log('[DolphinClient] Falling back to SSE (Server-Sent Events)');
    const token = this.getToken();
    const tokenParam = token ? '?token=' + encodeURIComponent(token) : '';
    const sseUrl = this.baseUrl + '/realtime/sse' + tokenParam;
    const sse = new EventSource(sseUrl);
    this.sseConnection = sse;
    
    sse.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.realtimeCallbacks.forEach(cb => cb(data));
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
        cleanSegments.push(seg.replace(/[^a-zA-Z0-9_]/g, '_'));
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

  const generatedCode = `
(function(global) {
  ${coreCode}

  DolphinClient.prototype._initSDK = function() {
    const client = this;
    ${methodsCode.join('\n')}
  };

  const client = new DolphinClient();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { client, DolphinClient };
  }
  
  if (typeof global !== 'undefined') {
    global.client = client;
    global.DolphinClient = DolphinClient;
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : (typeof self !== 'undefined' ? self : this))));
`;

  return generatedCode;
}

export function generateClientDTS(routes: any[]): string {
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
        cleanSegments.push(seg.replace(/[^a-zA-Z0-9_]/g, '_'));
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
`;

  return dtsCode.trim();
}
