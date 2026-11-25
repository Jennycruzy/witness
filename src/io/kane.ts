// Runs a saved Kane test (_test.md + its recordings) against a URL, on a throwaway copy of the test folder,
// so a heal or re-record never changes the user's suite unless we copy it back on purpose.
import { spawn } from 'node:child_process';
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, type Dirent } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { parseRun, type RunSummary } from '../core/stream.js';
import { startChrome } from './chrome.js';

export interface KaneRun { summary: RunSummary; ndjson: string; workDir: string; }

export interface RunOptions {
  testFile: string;          // path to x_test.md (its output-x/ folder sits next to it)
  url?: string;              // start URL to retarget the recording to (web)
  mobile?: { target: string; app: string; deviceName?: string; osVersion?: string };  // a mobile app build instead
  profileTemplate?: string;  // optional prepared Chrome profile with app state
  cdp?: string;              // an already running app window to drive (a desktop app) instead of a fresh Chrome
  rerecord?: boolean;        // --author: re-record every step on this build (costs credits)
  keepWorkDir?: boolean;
  timeoutSec?: number;
}

export async function runKane(o: RunOptions): Promise<KaneRun> {
  const workDir = mkdtempSync(join(tmpdir(), 'witness-run-'));
  cpSync(dirname(o.testFile), workDir, { recursive: true });
  const chrome = o.mobile || o.cdp ? null : await startChrome(o.profileTemplate);
  const args = ['testmd', 'run', basename(o.testFile), '--agent'];
  if (o.mobile) {
    args.push('--target', o.mobile.target, '--app', o.mobile.app);
    if (o.mobile.deviceName) args.push('--device-name', o.mobile.deviceName);
    if (o.mobile.osVersion) args.push('--os-version', o.mobile.osVersion);
  } else if (o.cdp) {
    // A desktop app window is already open on its own file:// page. Kane takes only http(s) start URLs and a reload would
    // lose the open document, so the test starts from the page as it is: no url in the test, and --allow-missing-url.
    const f = join(workDir, basename(o.testFile));
    writeFileSync(f, stripStartUrl(readFileSync(f, 'utf8')));
    args.push('--cdp-endpoint', o.cdp, '--allow-missing-url');
  }
  else args.push('--override-start-url', o.url!, '--cdp-endpoint', chrome!.endpoint);
  if (o.rerecord) args.push('--author'); else args.push('--no-adaptive-heal');
  let out = '', err = '';
  try {
    out = await new Promise<string>((resolve) => {
      const p = spawn('kane-cli', args, { cwd: workDir, stdio: ['ignore', 'pipe', 'pipe'] });
      let buf = '';
      p.stdout.on('data', d => { buf += d; });
      p.stderr.on('data', d => { err += d; });
      const t = setTimeout(() => p.kill('SIGKILL'), (o.timeoutSec ?? 600) * 1000);
      p.on('close', () => { clearTimeout(t); resolve(buf); });
    });
  } finally { chrome?.stop(); }
  // kane-cli refused to start (a bad flag or URL): that says nothing about the app, so it must not read as a test result.
  const refused = !out.trim() && /^error: .*/m.exec(err);
  if (refused) { rmSync(workDir, { recursive: true, force: true }); throw new Error(`kane-cli would not start: ${refused[0].slice(7)}`); }
  writeFileSync(join(workDir, 'kane.ndjson'), out);
  const run = { summary: parseRun(out), ndjson: out, workDir };
  if (!o.keepWorkDir) rmSync(workDir, { recursive: true, force: true });
  return run;
}

/** Removes the url: line from a test's front matter (the --- block at the top). */
export function stripStartUrl(md: string): string {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(md);
  if (!m) return md;
  return `---\n${m[1].split('\n').filter(l => !/^url:/.test(l)).join('\n')}\n---\n` + md.slice(m[0].length);
}

/** sha256 over the test file and every file of its recording folder (output-<name>/), in a stable order. */
export function recordingHash(testFile: string): string {
  const h = createHash('sha256');
  const dir = dirname(testFile);
  const name = basename(testFile).replace(/_test\.md$/, '');
  const files = [basename(testFile), ...listFiles(join(dir, `output-${name}`)).map(f => join(`output-${name}`, f))]
    .filter(f => !/Result\.md$|\.lock$|state/i.test(f)).sort();
  for (const f of files) { h.update(f); h.update(readFileSync(join(dir, f))); }
  return h.digest('hex');
}

function listFiles(root: string, prefix = ''): string[] {
  let out: string[] = [];
  let entries: Dirent[] = [];
  try { entries = readdirSync(root, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const rel = prefix ? join(prefix, e.name) : e.name;
    if (e.isDirectory()) out = out.concat(listFiles(join(root, e.name), rel)); else out.push(rel);
  }
  return out;
}
