import { describe, expect, it, vi } from 'vitest';

const results: Record<string, { status: string; kind?: string }> = {};
vi.mock('../src/io/npm.js', () => ({ fetchBuild: async (_n: string, v: string) => `/builds/${v}` }));
vi.mock('../src/io/serve.js', () => ({ serveDir: async (dir: string) => ({ url: `http://x/${dir.split('/').pop()}`, close: async () => {} }) }));
vi.mock('../src/io/setup.js', () => ({ prepareProfile: async () => ({ dir: '/p', remove: () => {} }) }));
vi.mock('../src/io/kane.js', () => ({
  runKane: async ({ url }: { url: string }) => {
    const r = results[url.split('/').pop()!];
    return { summary: { status: r.status, failed: r.kind ? { kind: r.kind } : null } };
  },
}));
const { search } = await import('../src/commands/search.js');

const vs = ['a', 'b', 'c', 'd', 'e'].map((version, i) => ({ version, time: `2026-09-0${i + 1}T00:00:00Z` }));
const quiet = () => {};

describe('witness search', () => {
  it('stops when the build given as good fails too, instead of naming a wrong window', async () => {
    for (const v of 'abcde') results[v] = { status: 'failed', kind: 'check' };
    await expect(search({ npm: 'x' }, [...vs], '/t_test.md', '/tmp/witness-search-test', quiet)).rejects.toThrow(/GOOD_FAILS/);
  });
  it('finds the first bad build once both ends are confirmed', async () => {
    Object.assign(results, { a: { status: 'passed' }, b: { status: 'passed' }, c: { status: 'failed', kind: 'check' }, d: { status: 'failed', kind: 'check' }, e: { status: 'failed', kind: 'check' } });
    const r = await search({ npm: 'x' }, [...vs], '/t_test.md', '/tmp/witness-search-test', quiet);
    expect([r.lastGood, r.firstBad]).toEqual(['b', 'c']);
  });
  it('stops when the build given as bad does not fail at a check', async () => {
    for (const v of 'abcde') results[v] = { status: 'passed' };
    await expect(search({ npm: 'x' }, [...vs], '/t_test.md', '/tmp/witness-search-test', quiet)).rejects.toThrow(/BAD_PASSES/);
  });
});
