// witness teach: what it tells Kane's bug memory for each verdict, on real Kane runs and a stand-in kane-cli.
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NOTE_LIMIT, runIds, teach, teachPlan } from '../src/commands/teach.js';
import type { Decision } from '../src/core/classify.js';

const dec = (verdict: string, kaneLabel: string | null): Decision => ({ verdict: verdict as any, kaneLabel, kaneConfidence: 0.9, why: '', next: '' });
const ev = (f: string) => readFileSync(new URL(`../evidence/${f}`, import.meta.url), 'utf8');

describe('what WITNESS tells Kane', () => {
  it('APP_BUG that Kane blamed on the test: real + rca-wrong, and a note under 120 characters', () => {
    const p = teachPlan(dec('APP_BUG', 'automation_bug'), 'TodoMVC vue (same commit)')!;
    expect(p.marks).toEqual(['real', 'rca-wrong']);
    expect(p.note.length).toBeLessThanOrEqual(NOTE_LIMIT);
    expect(p.note).toMatch(/^Real app bug/);
  });
  it('APP_BUG that Kane got right: real + rca-right', () => expect(teachPlan(dec('APP_BUG', 'application_issue'), 'x')!.marks).toEqual(['real', 'rca-right']));
  it('STATE_BUG: real, and the note says it needs saved data', () => {
    const p = teachPlan(dec('STATE_BUG', 'automation_bug'), 'Actual 25.11.0')!;
    expect(p.marks).toEqual(['real', 'rca-wrong']);
    expect(p.note).toMatch(/only with data Actual 25.11.0 saved/);
  });
  it('TEST_PROBLEM that Kane called an app bug: not-real + rca-wrong', () => expect(teachPlan(dec('TEST_PROBLEM', 'application_issue'), 'x')!.marks).toEqual(['not-real', 'rca-wrong']));
  it('says nothing for verdicts the comparison does not settle', () => {
    for (const v of ['ENV', 'STALE', 'PASS', 'UNKNOWN', 'NO_RECORDING']) expect(teachPlan(dec(v, 'automation_bug'), 'x')).toBeNull();
  });
  it('never closes a bug, and keeps a long reference name inside the note limit', () => {
    for (const v of ['APP_BUG', 'STATE_BUG', 'TEST_PROBLEM']) for (const l of ['automation_bug', 'application_issue', null]) {
      const p = teachPlan(dec(v, l), 'a very long reference build name that goes on and on and on')!;
      expect(p.marks.some(m => ['done', 'not-a-bug', 'reopen'].includes(m))).toBe(false);
      expect(p.note.length).toBeLessThanOrEqual(NOTE_LIMIT);
    }
  });
  it('reads the run ids from real Kane runs (kane-cli #241 pack)', () => {
    expect(runIds(ev('kane-cli-241/runs/1-before-note-port-42443.ndjson'))).toEqual({ session: '79bbc311-a086-4a32-8235-8ed9accfa157', knownBug: null });
    expect(runIds(ev('kane-cli-241/runs/4-after-note-port-42443-a.ndjson')).knownBug).toBe('BUG-5');
  });
});

/** A stand-in kane-cli for `bugs list/show/mark/note`: BUG-9 holds the run's occurrence; feedback is kept in a file. */
function fakeKane(session: string, existing: any[] = []) {
  const dir = mkdtempSync(join(tmpdir(), 'fake-kane-bugs-'));
  writeFileSync(join(dir, 'fb.json'), JSON.stringify(existing));
  writeFileSync(join(dir, 'kane-cli'), `#!/usr/bin/env node
const fs = require('fs'), path = require('path'); const a = process.argv.slice(2); const fbf = ${JSON.stringify(join(dir, 'fb.json'))};
fs.appendFileSync(${JSON.stringify(join(dir, 'calls'))}, a.join(' ') + '\\n');
const fb = JSON.parse(fs.readFileSync(fbf, 'utf8')); const out = o => console.log(JSON.stringify({ ok: true, ...o }));
if (a[1] === 'list') out({ bugs: [{ ref: 'BUG-8', family: 'automation_bug' }, { ref: 'BUG-9', family: 'automation_bug' }] });
else if (a[1] === 'show') out({ bug: { ref: a[2], status: 'open', card: { family: 'automation_bug', page_pattern: '127.0.0.1:42443/' } }, occurrences: [{ run_key: a[2] === 'BUG-9' ? ${JSON.stringify(session)} : 'other' }], feedback: fb });
else if (a[1] === 'mark') { const v = { real: ['vote_real','1'], 'not-real': ['vote_real','-1'], 'rca-right': ['vote_rca','1'], 'rca-wrong': ['vote_rca','-1'] }[a[3]]; fb.push({ id: 'f' + fb.length, type: v[0], value: v[1], retired_at: null, created_at: new Date().toISOString() }); fs.writeFileSync(fbf, JSON.stringify(fb)); out({ ref: a[2] }); }
else if (a[1] === 'note') { fb.push({ id: 'f' + fb.length, type: 'note', text: a[3], retired_at: null, created_at: new Date().toISOString() }); fs.writeFileSync(fbf, JSON.stringify(fb)); out({ ref: a[2] }); }
`);
  chmodSync(join(dir, 'kane-cli'), 0o755);
  return { dir, calls: () => existsSync(join(dir, 'calls')) ? readFileSync(join(dir, 'calls'), 'utf8').trim().split('\n') : [] };
}

function runDir(verdict: string, label: string, ndjson: string) {
  const d = mkdtempSync(join(tmpdir(), 'witness-teach-'));
  writeFileSync(join(d, 'decision.json'), JSON.stringify({ decision: dec(verdict, label) }));
  copyFileSync(new URL(`../evidence/${ndjson}`, import.meta.url), join(d, 'target.ndjson'));
  mkdirSync(join(d, 'tests')); writeFileSync(join(d, 'tests', 'blank_ignored_test.md'), '# t\n');
  return d;
}

async function withPath<T>(dir: string, fn: () => Promise<T>) {
  const old = process.env.PATH; process.env.PATH = `${dir}:${old}`;
  try { return await fn(); } finally { process.env.PATH = old; }
}

describe('witness teach against Kane bug memory', () => {
  it('finds the bug Kane filed for this run by its session id, marks it and adds the note once', async () => {
    const d = runDir('APP_BUG', 'automation_bug', 'kane-cli-241/runs/1-before-note-port-42443.ndjson');
    const f = fakeKane('79bbc311-a086-4a32-8235-8ed9accfa157');
    const r = await withPath(f.dir, () => teach(d, join(d, 'tests', 'blank_ignored_test.md'), 'TodoMVC vue', () => {}));
    expect(r.bug).toBe('BUG-9');
    expect(r.marked).toEqual(['real', 'rca-wrong']);
    expect(r.noted).toMatch(/^Real app bug/);
    expect(f.calls().filter(c => /^bugs (mark|note)/.test(c)).length).toBe(3);
    // A second run says nothing new.
    const r2 = await withPath(f.dir, () => teach(d, join(d, 'tests', 'blank_ignored_test.md'), 'TodoMVC vue', () => {}));
    expect(r2.marked).toEqual([]); expect(r2.noted).toBeNull();
    expect(f.calls().filter(c => /^bugs (mark|note)/.test(c)).length).toBe(3);
    expect(JSON.parse(readFileSync(join(d, 'teach.json'), 'utf8')).bug).toBe('BUG-9');
  });
  it('uses the bug Kane says it recalled (known_bug_id) without searching', async () => {
    const d = runDir('APP_BUG', 'automation_bug', 'kane-cli-241/runs/4-after-note-port-42443-a.ndjson');
    const f = fakeKane('none');
    const r = await withPath(f.dir, () => teach(d, join(d, 'tests', 'blank_ignored_test.md'), 'TodoMVC vue', () => {}));
    expect(r.bug).toBe('BUG-5');
    expect(f.calls().some(c => c.startsWith('bugs list'))).toBe(false);
  });
  it('touches nothing on ENV', async () => {
    const d = runDir('ENV', 'automation_bug', 'kane-cli-241/runs/1-before-note-port-42443.ndjson');
    const f = fakeKane('79bbc311-a086-4a32-8235-8ed9accfa157');
    const r = await withPath(f.dir, () => teach(d, join(d, 'tests', 'blank_ignored_test.md'), 'x', () => {}));
    expect(r.bug).toBeNull(); expect(f.calls()).toEqual([]);
  });
});
