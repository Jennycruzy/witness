import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { findBlindChecks, hiddenTextReason } from '../src/core/blind.js';

const dir = new URL('./fixtures/', import.meta.url);
const fx = (n: string) => readFileSync(new URL(n, dir), 'utf8');

describe('blind checks', () => {
  it('flags the real #2315 check that passed reading "\\nb" on the buggy svelte build', () => {
    for (const f of ['todomvc-2315-edit-target-svelte.ndjson', 'todomvc-2315-edit-target-svelte-run2.ndjson']) {
      const found = findBlindChecks(fx(f));
      expect(found.map(b => b.variable)).toEqual(['todo_list_exactly_one_b_check']);
      expect(found[0].runId).toBe('run-2');
    }
  });

  it('does not flag the same check on the correct (vue) build or on the fixed svelte build', () => {
    expect(findBlindChecks(fx('todomvc-2315-edit-reference-vue.ndjson'))).toEqual([]);
    expect(findBlindChecks(fx('todomvc-2315-edit-fixed-svelte.ndjson'))).toEqual([]);
  });

  it('raises no flags on any other real run in the fixtures', () => {
    const others = readdirSync(dir).filter(f => f.endsWith('.ndjson') && !f.startsWith('todomvc-2315-edit-target'));
    for (const f of others) expect(findBlindChecks(fx(f)), f).toEqual([]);
  });

  it('plain values are not flagged', () => {
    expect(hiddenTextReason('b')).toBeNull();
    expect(hiddenTextReason('50.00')).toBeNull();
    expect(hiddenTextReason('a\nb')).toBeNull();
  });
});
