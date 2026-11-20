// Minimal static server with cross-origin isolation headers (Actual needs SharedArrayBuffer).
// usage: node serve.mjs <dir> <port>
import http from 'node:http'; import { readFile, stat } from 'node:fs/promises'; import { join, normalize, extname } from 'node:path';
const [root, port] = [process.argv[2], Number(process.argv[3])];
const T = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css', '.json':'application/json', '.wasm':'application/wasm', '.svg':'image/svg+xml', '.png':'image/png', '.ico':'image/x-icon', '.webmanifest':'application/manifest+json', '.woff2':'font/woff2', '.txt':'text/plain', '.sqlite':'application/octet-stream' };
http.createServer(async (req, res) => {
  let p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  let f = join(root, p);
  if (!f.startsWith(root)) { res.writeHead(403).end(); return; }
  try { if ((await stat(f)).isDirectory()) f = join(f, 'index.html'); } catch { f = join(root, 'index.html'); }
  try { const b = await readFile(f); res.writeHead(200, { 'content-type': T[extname(f)] || 'application/octet-stream', 'cross-origin-opener-policy': 'same-origin', 'cross-origin-embedder-policy': 'require-corp', 'cache-control': 'no-store' }); res.end(b); }
  catch { res.writeHead(404).end(); }
}).listen(port, '127.0.0.1', () => console.log('serving', root, 'on', port));
