#!/usr/bin/env node
/** Serves the design folder at http://localhost:4173 so the mockups can be browsed. Usage: node tools/design/serve.mjs */
import { fileURLToPath } from 'node:url';
import { startStaticServer } from './static-server.mjs';

const root = fileURLToPath(new URL('../../design/', import.meta.url));
const { port } = await startStaticServer(root, Number(process.env.PORT ?? 4173));
console.log(`design board: http://localhost:${port}/`);
