// Serves a built app folder on 127.0.0.1 so Kane can open it. Optional cross-origin isolation headers.
import { createServer, type Server } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const TYPES: Record<string, string> = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json', '.txt': 'text/plain', '.map': 'application/json',
};

export interface Served { url: string; close: () => Promise<void>; }

export async function serveDir(root: string, opts: { isolation?: boolean } = {}): Promise<Served> {
  const server: Server = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    let file = join(root, path);
    if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
    try { if ((await stat(file)).isDirectory()) file = join(file, 'index.html'); } catch { file = join(root, 'index.html'); }
    try {
      const body = await readFile(file);
      const headers: Record<string, string> = { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' };
      if (opts.isolation) { headers['cross-origin-opener-policy'] = 'same-origin'; headers['cross-origin-embedder-policy'] = 'require-corp'; }
      res.writeHead(200, headers).end(body);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  const a = server.address();
  const port = typeof a === 'object' && a ? a.port : 0;
  return { url: `http://127.0.0.1:${port}/`, close: () => new Promise(r => server.close(() => r())) };
}
