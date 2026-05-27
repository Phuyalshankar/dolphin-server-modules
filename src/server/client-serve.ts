import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function clientHandler(ctx: any) {
  // Look for client.js relative to this server module (works both in dev and as installed package)
  const clientPath = path.resolve(__dirname, '../../scripts/client.js');
  if (fs.existsSync(clientPath)) {
    const content = fs.readFileSync(clientPath, 'utf8');
    ctx.setHeader('Content-Type', 'application/javascript');
    ctx.res.end(content);
    return;
  }
  return ctx.status(404).json({ error: 'Client library not found' });
}
