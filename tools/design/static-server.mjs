import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

/** Minimal static file server for the design folder (dev tool only; binds to localhost). */
export function startStaticServer(root, port = 0) {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      let path = normalize(join(root, decodeURIComponent(url.pathname)));
      if (!path.startsWith(normalize(root))) {
        res.writeHead(403).end('forbidden');
        return;
      }
      if (url.pathname.endsWith('/')) path = join(path, 'index.html');
      const data = await readFile(path);
      res.writeHead(200, {
        'content-type': MIME[extname(path)] ?? 'application/octet-stream',
        'cache-control': 'no-store',
      });
      res.end(data);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}
