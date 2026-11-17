// Starts a throwaway headless Chrome that Kane attaches to through --cdp-endpoint.
import { spawn, type ChildProcess } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface Chrome { endpoint: string; stop: () => void; }

const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.listen(0, '127.0.0.1', () => { const a = s.address(); s.close(() => (typeof a === 'object' && a ? resolve(a.port) : reject(new Error('no port')))); });
  });
}

/** profileTemplate: optional prepared Chrome profile (app state); it is copied, never used directly. */
export async function startChrome(profileTemplate?: string): Promise<Chrome> {
  const port = await freePort();
  const profile = mkdtempSync(join(tmpdir(), 'witness-chrome-'));
  if (profileTemplate && existsSync(profileTemplate)) cpSync(profileTemplate, profile, { recursive: true });
  const proc: ChildProcess = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-dev-shm-usage', '--window-size=1366,900',
    ...(process.getuid?.() === 0 ? ['--no-sandbox'] : []),   // Chrome will not start as root without it
    'about:blank',
  ], { stdio: 'ignore', detached: false });
  const endpoint = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`${endpoint}/json/version`); if (r.ok) break; } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 250));
  }
  return { endpoint, stop: () => {
    try { proc.kill('SIGKILL'); } catch { /* gone */ }
    // Chrome may still be writing its profile for a moment after it is killed: retry, never fail the run over cleanup.
    try { rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch { /* left for the OS temp cleaner */ }
  } };
}
