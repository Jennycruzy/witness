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

export async function serveDir(root: string, opts: { isolation?: boolean; port?: number } = {}): Promise<Served> {
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
  await new Promise<void>((r, j) => { server.once('error', j); server.listen(opts.port ?? 0, '127.0.0.1', r); });
  const a = server.address();
  const port = typeof a === 'object' && a ? a.port : 0;
  return { url: `http://127.0.0.1:${port}/`, close: () => new Promise(r => server.close(() => r())) };
}

/**
 * Starts a build that has its own server (for example an app plus its sync server) with a shell command that gets
 * {port} and {data}, and waits until it answers on 127.0.0.1:{port}. close() stops the whole process group.
 */
export async function serveCommand(command: string, port: number, data: string, waitSec = 120): Promise<Served> {
  const { spawn } = await import('node:child_process');
  const cmd = command.replaceAll('{port}', String(port)).replaceAll('{data}', data);
  const url = `http://127.0.0.1:${port}/`;
  const answers = async () => { try { await fetch(url); return true; } catch { return false; } };
  // The build before may still hold the port for a moment: wait until it is free.
  for (let i = 0; i < 80 && await answers(); i++) await new Promise(r => setTimeout(r, 250));
  if (await answers()) throw new Error(`port ${port} is still in use by another server`);
  const p = spawn(cmd, { shell: true, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  let output = '';
  const keep = (d: Buffer) => { output = (output + d).slice(-4000); };
  p.stdout!.on('data', keep); p.stderr!.on('data', keep);
  let up = false;
  for (let i = 0; i < waitSec * 4 && p.exitCode === null; i++) {
    if (await answers()) { up = true; break; }
    await new Promise(r => setTimeout(r, 250));
  }
  const stop = async () => {
    try { process.kill(-p.pid!, 'SIGTERM'); } catch { /* gone */ }
    for (let i = 0; i < 40; i++) { if (!await answers()) break; await new Promise(r => setTimeout(r, 250)); }
    try { process.kill(-p.pid!, 'SIGKILL'); } catch { /* gone */ }
    await new Promise(r => setTimeout(r, 500));
  };
  if (!up) { await stop(); throw new Error(`the build did not answer on ${url}${p.exitCode !== null ? ` (it exited with ${p.exitCode})` : ''}: ${cmd}\n${output.trim().split('\n').slice(-15).join('\n')}`); }
  return { url, close: stop };
}
