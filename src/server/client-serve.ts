import { generateClientJS, generateClientDTS } from './client-generator.js';
import { URL } from 'url';

export function clientHandler(ctx: any, routes: any[] = []) {
  // Read platform parameter from request query or headers
  let platform = '';
  if (ctx.req) {
    if (ctx.req.headers && ctx.req.headers['x-dolphin-platform']) {
      platform = ctx.req.headers['x-dolphin-platform'];
    } else if (ctx.req.url) {
      try {
        const parsedUrl = new URL(ctx.req.url, 'http://localhost');
        platform = parsedUrl.searchParams.get('platform') || '';
      } catch {}
    }
  }

  const content = generateClientJS(routes, platform);
  ctx.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  ctx.res.end(content);
}

export function clientDTSHandler(ctx: any, routes: any[] = []) {
  const content = generateClientDTS(routes);
  ctx.setHeader('Content-Type', 'text/plain; charset=utf-8');
  ctx.res.end(content);
}

