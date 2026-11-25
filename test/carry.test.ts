// Saved-state check (guard --carry-state): the decision rule on real Kane output, and the whole flow with a
// stand-in kane-cli and a tiny server served by command on one fixed port, without Chrome, credits or a login.
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseRun } from '../src/core/stream.js';
import { classifyCarried } from '../src/core/classify.js';
import { guard } from '../src/commands/guard.js';

const fx = (n: string) => new URL(`./fixtures/${n}.ndjson`, import.meta.url).pathname;
const run = (n: string) => parseRun(readFileSync(fx(n), 'utf8'));
const FAIL_CHECK = 'todomvc-2315-edit-target-svelte', PASS = 'todomvc-2315-edit-reference-vue', FAIL_ACTION = 'actual-layout-target-26.7.0';

describe('saved-state verdict', () => {
  it('STATE_BUG when only the run with saved data fails', () => {
    const d = classifyCarried(run(FAIL_CHECK), run(PASS), run(PASS));
    expect(d.verdict).toBe('STATE_BUG');
    expect(d.why).toMatch(/clean test run cannot see/);
  });
  it('real Actual #6574 runs (25.11.0 vs 26.11.0, newest release): STATE_BUG, and a clean Kane run passes', () => {
    const ev = (n: string) => parseRun(readFileSync(new URL(`../evidence/actual-6574-saved-state/${n}.ndjson`, import.meta.url), 'utf8'));
    const [carried, clean, reference] = [ev('target'), ev('target-clean'), ev('reference')];
    expect(clean.status).toBe('passed');              // what a plain Kane run on the new release sees
    expect(carried.status).toBe('failed');
    expect(carried.failed?.kind).toBe('check');
    const d = classifyCarried(carried, clean, reference);
    expect(d.verdict).toBe('STATE_BUG');
    expect(d.kaneLabel).toBe('application_issue');
  });
  it('a plain APP_BUG when the clean browser fails too', () => {
    expect(classifyCarried(run(FAIL_CHECK), run(FAIL_CHECK), run(PASS)).verdict).toBe('APP_BUG');
  });
  it('ENV when the reference fails with the same saved data', () => {
    expect(classifyCarried(run(FAIL_CHECK), run(PASS), run(FAIL_CHECK)).verdict).toBe('ENV');
  });
  it('PASS when the run with saved data passes', () => {
    expect(classifyCarried(run(PASS), run(PASS), run(PASS)).verdict).toBe('PASS');
  });
  it('an action failure that only happens with saved data is still a STATE_BUG', () => {
    expect(classifyCarried(run(FAIL_ACTION), run(PASS), run(PASS)).verdict).toBe('STATE_BUG');
  });
});

async function freePort(): Promise<number> {
  return new Promise(r => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const a = s.address() as any; s.close(() => r(a.port)); }); });
}

/** kane-cli stand-in: passes unless the profile Chrome got holds a file named "saved" AND the server says "new". */
function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'witness-carry-test-'));
  const bin = join(dir, 'bin'); mkdirSync(bin);
  writeFileSync(join(bin, 'kane-cli'), `#!/usr/bin/env node
const fs = require('fs'), path = require('path');
const a = process.argv.slice(2); const url = a[a.indexOf('--override-start-url') + 1]; const cdp = a[a.indexOf('--cdp-endpoint') + 1];
fs.appendFileSync(${JSON.stringify(join(dir, 'calls'))}, url + ' ' + cdp + '\\n');
fetch(cdp + '/json/version').then(r => r.json()).then(async () => {
  const build = await (await fetch(url)).text();
  const prof = require('child_process').execSync('ps -eo args').toString().split('\\n').find(l => l.includes(cdp.split(':').pop()) && l.includes('--user-data-dir=')) || '';
  const pdir = (prof.match(/--user-data-dir=(\\S+)/) || [])[1];
  const saved = pdir && fs.existsSync(path.join(pdir, 'saved'));
  const fail = build.trim() === 'new' && saved;
  process.stdout.write(fs.readFileSync(fail ? ${JSON.stringify(fx(FAIL_CHECK))} : ${JSON.stringify(fx(PASS))}, 'utf8'));
});
`);
  chmodSync(join(bin, 'kane-cli'), 0o755);
  // A fake Chrome that answers /json/version on its debugging port and keeps its profile.
  writeFileSync(join(bin, 'chrome'), `#!/usr/bin/env node
const port = process.argv.find(x => x.startsWith('--remote-debugging-port=')).split('=')[1];
require('http').createServer((q, s) => s.end('{}')).listen(port, '127.0.0.1');
`);
  chmodSync(join(bin, 'chrome'), 0o755);
  // The "build": a server that answers with its version on {port}.
  writeFileSync(join(dir, 'srv.js'), `require('http').createServer((q, s) => s.end(process.argv[2])).listen(Number(process.argv[3]), '127.0.0.1');`);
  mkdirSync(join(dir, 'tests', 'output-flow', '.internal'), { recursive: true });
  writeFileSync(join(dir, 'tests', 'flow_test.md'), '# flow\n\n## Open\nOpen the budget.\n\n## Check\nCheck the budget shows To Budget.\n');
  writeFileSync(join(dir, 'tests', 'output-flow', '.internal', 'meta.json'), '{}');
  return { dir, bin };
}

async function withEnv<T>(bin: string, fn: () => Promise<T>) {
  const old = { PATH: process.env.PATH, CHROME_PATH: process.env.CHROME_PATH };
  process.env.PATH = `${bin}:${old.PATH}`; process.env.CHROME_PATH = join(bin, 'chrome');
  try { return await fn(); } finally { process.env.PATH = old.PATH; if (old.CHROME_PATH === undefined) delete process.env.CHROME_PATH; else process.env.CHROME_PATH = old.CHROME_PATH; }
}

describe('guard --carry-state, whole flow', () => {
  const cfg = (dir: string, port: number, history: string) => ({
    tests: [join(dir, 'tests', 'flow_test.md')],
    target: { serve: `node ${dir}/srv.js new {port}`, setup: `mkdir -p {profile}` },
    reference: { serve: `node ${dir}/srv.js old {port}` },
    evidenceDir: join(dir, 'runs'), cacheDir: join(dir, 'cache'),
    carryState: { port, history: [{ build: 'reference', run: history }] },
  });
  it('STATE_BUG: fails with the profile the reference saved, passes clean and on the reference', async () => {
    const { dir, bin } = setup(); const port = await freePort();
    const r = await withEnv(bin, () => guard(cfg(dir, port, `curl -s {url} > /dev/null; mkdir -p {profile} && echo x > {profile}/saved`) as any, join(dir, 'tests', 'flow_test.md'), () => {}, { carryState: true }));
    expect(r.decision.verdict).toBe('STATE_BUG');
    const calls = readFileSync(join(dir, 'calls'), 'utf8').trim().split('\n');
    expect(calls.length).toBe(3);                                   // target saved, target clean, reference saved
    expect(calls.every(c => c.startsWith(`http://127.0.0.1:${port}/`))).toBe(true);   // one origin for every run
    for (const f of ['history.txt', 'target.ndjson', 'target-clean.ndjson', 'reference.ndjson', 'card.md']) expect(existsSync(join(r.evidenceDir, f))).toBe(true);
    expect(readFileSync(join(r.evidenceDir, 'card.md'), 'utf8')).toMatch(/Do not edit tests/);
  }, 60_000);
  it('PASS when the history saves nothing that breaks the target; only one Kane run', async () => {
    const { dir, bin } = setup(); const port = await freePort();
    const r = await withEnv(bin, () => guard(cfg(dir, port, `mkdir -p {profile}`) as any, join(dir, 'tests', 'flow_test.md'), () => {}, { carryState: true }));
    expect(r.decision.verdict).toBe('PASS');
    expect(readFileSync(join(dir, 'calls'), 'utf8').trim().split('\n').length).toBe(1);
  }, 60_000);
  it('runs the reference on the data it saved itself, even after a newer build changed the data (as a server migration does)', async () => {
    const { dir, bin } = setup(); const port = await freePort();
    writeFileSync(join(dir, 'srv-old.js'), `if (require('fs').existsSync(process.argv[3] + '/migrated')) { console.error('Missing migration file'); process.exit(1); }
require('http').createServer((q, s) => s.end('old')).listen(Number(process.argv[2]), '127.0.0.1');`);
    const c = cfg(dir, port, `mkdir -p {profile} && echo x > {profile}/saved`) as any;
    c.reference.serve = `node ${dir}/srv-old.js {port} {data}`;
    c.target.serve = `touch {data}/migrated; node ${dir}/srv.js new {port}`;
    c.carryState.history.push({ build: 'target', run: 'mkdir -p {dir}/phone' });
    const r = await withEnv(bin, () => guard(c, c.tests[0], () => {}, { carryState: true }));
    expect(r.decision.verdict).toBe('STATE_BUG');
    expect(r.reference?.status).toBe('passed');
  }, 60_000);
  it('each target attempt starts on a fresh copy of the saved server data, so one attempt cannot change what the next sees', async () => {
    const { dir, bin } = setup(); const port = await freePort();
    // The target server writes to its data folder on every request, as an app that saves on load would.
    writeFileSync(join(dir, 'srv-writes.js'), `const fs = require('fs'); fs.appendFileSync(process.argv[4], 'start:' + fs.readdirSync(process.argv[3]).join(',') + '\\n');
require('http').createServer((q, s) => { fs.writeFileSync(process.argv[3] + '/written-by-attempt', 'x'); s.end('new'); }).listen(Number(process.argv[2]), '127.0.0.1');`);
    const c = cfg(dir, port, `curl -s {url} > /dev/null; mkdir -p {profile} && echo x > {profile}/saved`) as any;
    c.target.serve = `node ${dir}/srv-writes.js {port} {data} ${dir}/seen`;
    const r = await withEnv(bin, () => guard(c, c.tests[0], () => {}, { carryState: true }));
    expect(r.decision.verdict).toBe('STATE_BUG');
    const seen = readFileSync(join(dir, 'seen'), 'utf8').trim().split('\n');
    expect(seen.length).toBe(2);                                    // saved-data run and clean run, each on its own server start
    expect(seen.some(l => l.includes('written-by-attempt'))).toBe(false);
  }, 60_000);
  it('refuses --carry-state without carryState in witness.json', async () => {
    const { dir } = setup();
    const c = cfg(dir, 1, ''); delete (c as any).carryState;
    await expect(guard(c as any, c.tests[0], () => {}, { carryState: true })).rejects.toThrow(/carryState/);
  });
});
