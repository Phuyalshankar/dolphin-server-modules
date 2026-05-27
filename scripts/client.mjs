// ESM entry point for "dolphin-server-modules/client"
// Allows: import { DolphinClient } from 'dolphin-server-modules/client'
// in Vite, React, Next.js, etc. without breaking classic <script src> usage.

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { DolphinClient } = require('./client.js');

export { DolphinClient };
