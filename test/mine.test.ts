// witness mine: which builds a fix is tested on, and the test file the writer's answer becomes.
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { pickBuilds, renderTest, summarize, type MineConfig } from '../src/commands/mine.js';
import { parseTestSteps } from '../src/core/card.js';

const m: MineConfig = { repo: 'o/r', since: '2026-01-01', until: '2026-02-01', builds: { npm: '@x/web', buildDir: 'build', isolation: true, settleHours: 3 }, setup: 'node setup.mjs {url} {profile}' };
const versions = [
  { version: '1.0.0-nightly.20260110', time: '2026-01-10T01:00:00Z' },
  { version: '1.0.0-nightly.20260111', time: '2026-01-11T01:00:00Z' },
  { version: '1.0.0-nightly.20260112', time: '2026-01-12T01:00:00Z' },
];
const pr = (mergedAt: string) => ({ number: 1, title: 't', body: '', mergedAt, mergeSha: 'abc', files: [], issues: [] });

describe('picking the builds around a fix', () => {
  it('buggy = last build published before the merge, fixed = first build published after it', async () => {
    const b = await pickBuilds(m, pr('2026-01-10T15:00:00Z'), { versions });
    expect(b?.buggy.version).toBe('1.0.0-nightly.20260110');
    expect(b?.fixed.version).toBe('1.0.0-nightly.20260111');
    expect(b?.fixed).toMatchObject({ npm: '@x/web', buildDir: 'build', isolation: true, setup: m.setup });
  });
  it('a build published within the settle time after the merge may not contain the fix, so it is skipped', async () => {
    const b = await pickBuilds(m, pr('2026-01-10T23:30:00Z'), { versions });
    expect(b?.buggy.version).toBe('1.0.0-nightly.20260110');
    expect(b?.fixed.version).toBe('1.0.0-nightly.20260112');
  });
  it('no build after the fix: no case', async () => {
    expect(await pickBuilds(m, pr('2026-01-12T00:00:00Z'), { versions })).toBeNull();
  });
});

describe('the test file', () => {
  it('is a Kane test with one step per heading and the check last', () => {
    const md = renderTest('Blank todo is ignored', [{ heading: 'Add blank', text: 'Type three spaces and press Enter.' }, { heading: 'Check', text: 'Verify the footer shows "0 items left".' }]);
    expect(md).toMatch(/^---\nmode: testing\nurl: http:\/\/127\.0\.0\.1:1\/\n/);
    const steps = parseTestSteps(md);
    expect(steps.length).toBe(2);
    expect(JSON.stringify(steps.at(-1))).toContain('Verify the footer');
  });
});

describe('the summary', () => {
  it('counts kept, missed and not-testable cases, and how often Kane named the app on the kept ones', () => {
    const out = mkdtempSync(join(tmpdir(), 'mine-'));
    const put = (n: number, meta: object, result?: object) => { mkdirSync(join(out, String(n))); writeFileSync(join(out, String(n), 'case.json'), JSON.stringify({ pr: n, ...meta })); if (result) writeFileSync(join(out, String(n), 'result.json'), JSON.stringify(result)); };
    put(1, { status: 'written' }, { result: 'KEPT', kaneLabel: 'automation_bug' });
    put(2, { status: 'written' }, { result: 'KEPT', kaneLabel: 'application_issue' });
    put(3, { status: 'written' }, { result: 'MISSED' });
    put(4, { status: 'not-testable' });
    const s = summarize(out, () => {});
    expect(s).toMatchObject({ candidates: 4, written: 3, run: 3, kept: 2, missed: 1, notTestable: 1, kaneRightOnKept: 1 });
  });
});
