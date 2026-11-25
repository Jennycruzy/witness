import { describe, expect, it } from 'vitest';
import { half, kaneRight, score, witnessRight, type BenchRow } from '../src/commands/bench.js';

describe('witness bench scoring', () => {
  it('scores Kane by what its label tells an agent to do', () => {
    expect(kaneRight('APP_BUG', { kaneLabel: 'application_issue', target: 'failed' })).toBe(true);
    expect(kaneRight('APP_BUG', { kaneLabel: 'automation_bug', target: 'failed' })).toBe(false);
    expect(kaneRight('APP_BUG', { kaneLabel: null, target: 'passed' })).toBe(false);          // passed a real bug
    expect(kaneRight('TEST_PROBLEM', { kaneLabel: 'automation_bug', target: 'failed' })).toBe(true);
    expect(kaneRight('PASS', { kaneLabel: null, target: 'passed' })).toBe(true);              // control: the good build passes
    expect(kaneRight('PASS', { kaneLabel: 'application_issue', target: 'failed' })).toBe(false);
    expect(kaneRight('ENV', { kaneLabel: 'automation_bug', target: 'failed' })).toBeNull();   // no right label to score
  });
  it('scores WITNESS by its verdict', () => {
    expect(witnessRight('APP_BUG', 'APP_BUG')).toBe(true);
    expect(witnessRight('PASS', 'APP_BUG')).toBe(false);
  });
  it('splits the held-out half by case id alone', () => {
    expect(half('mined-actual-8587')).toBe(half('mined-actual-8587'));
    const ids = Array.from({ length: 200 }, (_, i) => `case-${i}`);
    const b = ids.filter(i => half(i) === 'B').length;
    expect(b).toBeGreaterThan(70); expect(b).toBeLessThan(130);
  });
  it('counts per answer and per half', () => {
    const r = (id: string, truth: any, verdict: string, kaneLabel: string | null, target: string): BenchRow => ({ id, truth, half: half(id), verdict, kaneLabel, kaneConfidence: null, target, credits: 1 });
    const s = score([r('a', 'APP_BUG', 'APP_BUG', 'automation_bug', 'failed'), r('b', 'PASS', 'PASS', null, 'passed'), r('c', 'ENV', 'ENV', 'automation_bug', 'failed')]);
    expect(s.all).toEqual({ cases: 3, kaneRight: 1, kaneScored: 2, witnessRight: 3 });
    expect(s.credits).toBe(3);
  });
});

describe('setupHome', () => {
  it('finds the folder above a case that holds its setup script', async () => {
    const { mkdtempSync, mkdirSync, writeFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const { setupHome } = await import('../src/commands/bench.js');
    const root = mkdtempSync(join(tmpdir(), 'sh-'));
    mkdirSync(join(root, 'cases', '1'), { recursive: true });
    writeFileSync(join(root, 'setup.mjs'), '');
    expect(setupHome(join(root, 'cases', '1'), 'node setup.mjs {url} {profile}')).toBe(root);
    expect(setupHome(join(root, 'cases', '1'), undefined)).toBe(join(root, 'cases', '1'));
    expect(setupHome(join(root, 'cases', '1'), 'node nothere.mjs {url}')).toBe(join(root, 'cases', '1'));
  });
});
