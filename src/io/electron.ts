// Starts a desktop (Electron) app build under a virtual display with its DevTools port open, so Kane can drive
// its window through --cdp-endpoint the same way it drives a browser tab.
import { execSync, spawn } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { freePort } from './chrome.js';

export interface ElectronApp { url: string; cdp: string; data: string; close: () => Promise<void>; }

/** Fills {data} (a fresh scratch folder for documents the app opens) in a command or argument. */
export const fill = (s: string, data: string, profile: string) => s.replaceAll('{data}', data).replaceAll('{profile}', profile);

export async function startElectron(bin: string, args: string[] = [], opts: { setup?: string; profileTemplate?: string } = {}): Promise<ElectronApp> {
  if (!existsSync(bin)) throw new Error(`no app binary at ${bin}`);
  const port = await freePort();
  const data = mkdtempSync(join(tmpdir(), 'witness-doc-'));
  const profile = mkdtempSync(join(tmpdir(), 'witness-electron-'));
  if (opts.profileTemplate && existsSync(opts.profileTemplate)) cpSync(opts.profileTemplate, profile, { recursive: true });
  // The setup writes the documents (and any settings) the test starts from, before the app opens.
  if (opts.setup) execSync(fill(opts.setup, data, profile), { stdio: 'ignore', timeout: 120_000 });
  const argv = ['-a', '-s', '-screen 0 1920x1080x24', bin, '--no-sandbox', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    ...args.map(a => fill(a, data, profile))];
  const proc = spawn('xvfb-run', argv, { stdio: 'ignore', detached: true });
  const cdp = `http://127.0.0.1:${port}`;
  let url = '';
  for (let i = 0; i < 120 && !url; i++) {
    try {
      const pages = await (await fetch(`${cdp}/json/list`)).json() as { type: string; url: string }[];
      url = pages.find(p => p.type === 'page' && !p.url.startsWith('devtools:'))?.url ?? '';
    } catch { /* not up yet */ }
    if (!url) await new Promise(r => setTimeout(r, 500));
  }
  const close = async () => {
    try { process.kill(-proc.pid!, 'SIGKILL'); } catch { /* gone */ }
    for (const d of [data, profile]) try { rmSync(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch { /* temp cleaner */ }
  };
  if (!url) { await close(); throw new Error(`${bin} opened no window with a DevTools page on port ${port}`); }
  await new Promise(r => setTimeout(r, 3000));   // let the window finish loading the document
  return { url, cdp, data, close };
}
