import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { findPreview, isAiPr, loadPrConfig, prWitnessConfig, summaryLine, type PrCheck } from '../src/commands/pr.js';

const cfgPath = resolve(__dirname, '../examples/pr/actual/pr.json');

describe('witness pr', () => {
  it('finds the preview of this pull request among status links', () => {
    const links = ['https://app.netlify.com/projects/actualbudget/deploys/6b06', 'https://deploy-preview-9662.demo.actualbudget.org', 'https://github.com/actualbudget/actual/actions/runs/1'];
    const c = loadPrConfig(cfgPath);
    expect(findPreview(links, c.preview, 9662)).toBe('https://deploy-preview-9662.demo.actualbudget.org');
    expect(findPreview(links, c.preview, 9661)).toBeNull();
  });
  it('marks pull requests written by a coding agent', () => {
    expect(isAiPr('[AI] Close transaction date picker after selection')).toBe(true);
    expect(isAiPr('Bump mermaid')).toBe(false);
  });
  it('targets the preview and compares with the live main build', () => {
    const c = loadPrConfig(cfgPath);
    const w = prWitnessConfig(c, 'https://deploy-preview-1.demo.actualbudget.org', '/tmp/x');
    expect(w.target.url).toBe('https://deploy-preview-1.demo.actualbudget.org');
    expect(w.reference.url).toBe('https://edge.actualbudget.org');
    expect(w.tests).toHaveLength(4);
    expect(w.tests.every(t => t.startsWith('/') && t.endsWith('_test.md'))).toBe(true);
    expect(c.setup).toContain(resolve(__dirname, '../examples/pr/actual'));
    expect(c.setup).not.toContain('{base}');
  });
  it('says plainly what a check found', () => {
    const base: PrCheck = { repo: 'r', number: 1, title: 't', author: 'a', ai: true, headSha: 's', preview: 'p', live: 'l', started: '', seconds: 1, results: [] };
    const r = (test: string, verdict: string) => ({ test, verdict, why: '', next: '', kaneLabel: null, kaneConfidence: null, target: 'passed', reference: null, credits: 0, card: null });
    expect(summaryLine({ ...base, results: [r('a', 'PASS'), r('b', 'PASS')] })).toBe('all 2 tests pass on the preview');
    expect(summaryLine({ ...base, results: [r('a', 'APP_BUG'), r('b', 'PASS')] })).toMatch(/^1 of 2 tests found a bug this pull request adds: a/);
    expect(summaryLine({ ...base, results: [r('a', 'ENV')] })).toMatch(/no bug added by this pull request; a ENV/);
  });
});

describe('witness pr watch', () => {
  it('gives a pull request only the tests for the areas it changes', async () => {
    const { testsFor } = await import('../src/commands/pr.js');
    const c = loadPrConfig(cfgPath);
    const names = (files: string[]) => testsFor(c, files).map(t => t.split('/').pop());
    expect(names(['packages/desktop-client/src/components/schedules/ScheduleDetails.tsx'])).toEqual(['renaming_a_schedule_keeps_its_skipped_oc_test.md']);
    expect(names(['packages/desktop-client/src/components/accounts/Account.tsx', 'packages/desktop-client/src/components/budget/BudgetTable.tsx'])).toEqual(['search_filter_stays_applied_after_toggli_test.md', 'category_dropdown_menu_opens_again_after_test.md']);
    expect(names(['docs/README.md', 'packages/sync-server/src/app.ts'])).toEqual([]);
    expect(names(['packages/desktop-client/src/components/schedules/ScheduleDetails.test.tsx'])).toEqual([]);
  });
});

describe('branch behind main', () => {
  it('picks the newest matching build from before the split', async () => {
    const { buildBefore } = await import('../src/commands/pr.js');
    const vs = [{ version: '26.9.0', time: '2026-09-01T00:00:00Z' }, { version: '26.10.0-nightly.20261001', time: '2026-10-01T01:00:00Z' }, { version: '26.10.0-nightly.20261002', time: '2026-10-02T01:00:00Z' }];
    expect(buildBefore(vs, '2026-10-01T12:00:00Z', 'nightly')?.version).toBe('26.10.0-nightly.20261001');
    expect(buildBefore(vs, '2026-09-15T00:00:00Z', 'nightly')).toBeNull();
    expect(buildBefore(vs, '2026-09-15T00:00:00Z')?.version).toBe('26.9.0');
  });
  it('does not blame a pull request for a bug its starting point already had', async () => {
    const { splitDecision } = await import('../src/commands/pr.js');
    const d = { verdict: 'APP_BUG', why: 'The same recording passes on the reference build and fails here at a check.', next: 'x' };
    const base = { sha: 'abc', date: '2026-10-01T12:00:00Z', behindBy: 28 };
    expect(splitDecision(d, base, { version: 'n1', status: 'failed' }).verdict).toBe('BEHIND_MAIN');
    expect(splitDecision(d, base, { version: 'n1', status: 'passed' }).verdict).toBe('APP_BUG');
    expect(splitDecision(d, base, { version: 'n1', status: 'unknown' })).toEqual(d);
  });
});
