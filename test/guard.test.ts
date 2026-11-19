// Runs guard against a stand-in kane-cli that plays back real Kane output, to check the decision paths
// (one more replay after an action failure, a missing recording) without Chrome, credits or a login.
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { guard } from '../src/commands/guard.js';
import { resolveBuild } from '../src/io/reference.js';

const fx = (n: string) => new URL(`./fixtures/${n}.ndjson`, import.meta.url).pathname;

/** A fake kane-cli that prints the given fixture files, one per call, then repeats the last. */
function fakeKane(outputs: string[]) {
  const dir = mkdtempSync(join(tmpdir(), 'fake-kane-'));
  writeFileSync(join(dir, 'outputs.json'), JSON.stringify(outputs));
  writeFileSync(join(dir, 'kane-cli'), `#!/usr/bin/env node
const fs = require('fs'), path = require('path');
const dir = ${JSON.stringify(dir)};
const outs = JSON.parse(fs.readFileSync(path.join(dir, 'outputs.json'), 'utf8'));
const n = fs.existsSync(path.join(dir, 'n')) ? Number(fs.readFileSync(path.join(dir, 'n'), 'utf8')) : 0;
fs.writeFileSync(path.join(dir, 'n'), String(n + 1));
fs.appendFileSync(path.join(dir, 'calls'), process.argv.slice(2).join(' ') + '\\n');
if (process.argv.includes('--author')) { const name = process.argv[4].replace(/_test\\.md$/, ''); fs.mkdirSync(path.join(process.cwd(), 'output-' + name, '.internal'), { recursive: true }); fs.writeFileSync(path.join(process.cwd(), 'output-' + name, '.internal', 'meta.json'), '{}'); }
process.stdout.write(fs.readFileSync(outs[Math.min(n, outs.length - 1)], 'utf8'));
`);
  chmodSync(join(dir, 'kane-cli'), 0o755);
  return { dir, calls: () => readFileSync(join(dir, 'calls'), 'utf8').trim().split('\n') };
}

function project(withRecording = true) {
  const dir = mkdtempSync(join(tmpdir(), 'witness-proj-'));
  mkdirSync(join(dir, 'tests'));
  writeFileSync(join(dir, 'tests', 'flow_test.md'), '# flow\n\n## Step\nDo it.\n');
  if (withRecording) { mkdirSync(join(dir, 'tests', 'output-flow', '.internal'), { recursive: true }); writeFileSync(join(dir, 'tests', 'output-flow', '.internal', 'meta.json'), '{}'); }
  const app = { target: 'emulator' as const, app: 'APP_TEST' };
  return { dir, cfg: { tests: [join(dir, 'tests', 'flow_test.md')], target: { kane: app }, reference: { kane: app }, evidenceDir: join(dir, 'runs'), cacheDir: join(dir, 'cache') } };
}

async function withFake<T>(outputs: string[], fn: (f: ReturnType<typeof fakeKane>) => Promise<T>) {
  const f = fakeKane(outputs); const old = process.env.PATH;
  process.env.PATH = `${f.dir}:${old}`;
  try { return await fn(f); } finally { process.env.PATH = old; }
}

describe('guard decision paths', () => {
  it('replays once more after a failure at an action, and passes when the second replay passes', async () => {
    const p = project();
    await withFake([fx('actual-layout-target-26.7.0'), fx('todomvc-2315-edit-fixed-svelte')], async f => {
      const r = await guard(p.cfg as any, p.cfg.tests[0], () => {});
      expect(r.decision.verdict).toBe('PASS');
      expect(f.calls().length).toBe(2);
      expect(existsSync(join(r.evidenceDir, 'target-first-try.ndjson'))).toBe(true);
    });
  });
  it('still calls a repeated action failure a test problem when the reference passes', async () => {
    const p = project();
    await withFake([fx('actual-layout-target-26.7.0'), fx('actual-layout-target-26.7.0'), fx('actual-layout-reference-26.8.0')], async () => {
      const r = await guard(p.cfg as any, p.cfg.tests[0], () => {});
      expect(r.decision.verdict).toBe('TEST_PROBLEM');
    });
  });
  it('does not replay a failure at a check again: app bug when the reference passes', async () => {
    const p = project();
    await withFake([fx('todomvc-2315-edit-target-svelte'), fx('todomvc-2315-edit-reference-vue')], async f => {
      const r = await guard(p.cfg as any, p.cfg.tests[0], () => {});
      expect(r.decision.verdict).toBe('APP_BUG');
      expect(f.calls().length).toBe(2);
    });
  });
  it('passes the mobile app build to Kane instead of a browser', async () => {
    const p = project();
    await withFake([fx('todomvc-2315-edit-fixed-svelte')], async f => {
      await guard(p.cfg as any, p.cfg.tests[0], () => {});
      expect(f.calls()[0]).toContain('--target emulator --app APP_TEST');
      expect(f.calls()[0]).not.toContain('--cdp-endpoint');
    });
  });
  it('stops with NO_RECORDING when a test has no saved recording, and spends nothing', async () => {
    const p = project(false);
    await withFake([fx('todomvc-2315-edit-fixed-svelte')], async f => {
      const r = await guard(p.cfg as any, p.cfg.tests[0], () => {});
      expect(r.decision.verdict).toBe('NO_RECORDING');
      expect(existsSync(join(f.dir, 'calls'))).toBe(false);
    });
  });
  it('with --record-missing records once, checks the recording replays, then runs the check', async () => {
    const p = project(false);
    await withFake([fx('todomvc-2315-edit-fixed-svelte')], async f => {
      const r = await guard(p.cfg as any, p.cfg.tests[0], () => {}, { recordMissing: true });
      const calls = f.calls();
      expect(calls[0]).toContain('--author');
      expect(calls[1]).toContain('--no-adaptive-heal');
      expect(r.decision.verdict).toBe('PASS');
    });
  });
  it('rejects a new recording that does not replay on the reference build', async () => {
    const p = project(false);
    const lines: string[] = [];
    await withFake([fx('todomvc-2315-edit-fixed-svelte'), fx('todomvc-2315-edit-target-svelte')], async () => {
      const r = await guard(p.cfg as any, p.cfg.tests[0], s => lines.push(s), { recordMissing: true });
      expect(r.decision.verdict).toBe('NO_RECORDING');
      expect(lines.join('\n')).toContain('UNSTABLE');
    });
  });
});

describe('loose checks', () => {
  it('flags the real recorded check "exactly one todo" saved with expected "1" and no code to read the page', async () => {
    const { looseFromAction, lockedFromAction } = await import('../src/core/locked.js');
    const actions = readFileSync(new URL('./fixtures/loose/todomvc-count-step3.ndjson', import.meta.url), 'utf8').trim().split('\n').map(l => JSON.parse(l));
    const loose = actions.map(a => looseFromAction(a, 3)).filter(Boolean);
    expect(loose).toHaveLength(1);
    expect(loose[0]).toMatchObject({ step: 3, expected: '1' });
    expect(actions.map(a => lockedFromAction(a, 3)).filter(Boolean)).toHaveLength(1);
  });
});

describe('reference builds', () => {
  it('builds a git ref in its own worktree and serves its output folder', async () => {
    const repo = mkdtempSync(join(tmpdir(), 'witness-git-'));
    execSync('git init -q && git -c user.email=t@t -c user.name=t commit -q --allow-empty -m one', { cwd: repo });
    const r = await resolveBuild({ git: 'HEAD', repo, build: 'mkdir -p dist && echo ok > dist/index.html', dir: 'dist' }, join(repo, '.cache'), () => {});
    expect(readFileSync(join(r.dir!, 'index.html'), 'utf8').trim()).toBe('ok');
    expect(r.label).toMatch(/^HEAD \([0-9a-f]{12}\)$/);
  });
});
