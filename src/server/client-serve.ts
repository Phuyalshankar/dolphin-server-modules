import { generateClientJS, generateClientDTS } from './client-generator.js';

export function clientHandler(ctx: any, routes: any[] = []) {
  const content = generateClientJS(routes);
  ctx.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  ctx.res.end(content);
}

export function clientDTSHandler(ctx: any, routes: any[] = []) {
  const content = generateClientDTS(routes);
  ctx.setHeader('Content-Type', 'text/plain; charset=utf-8');
  ctx.res.end(content);
}
