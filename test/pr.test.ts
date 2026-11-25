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
