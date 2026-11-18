import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { lockedFromAction } from '../src/core/locked.js';

const actions = (f: string) => readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));

describe('locked checks', () => {
  it('flags the real TodoMVC es6 order check (#2311) that passed on b, a', () => {
    const hits = actions('test/fixtures/locked/es6-append-order-step2.ndjson').map(a => lockedFromAction(a, 2)).filter(Boolean);
    expect(hits.map(h => h!.expected)).toEqual(['a', 'b']);
    expect(hits.every(h => h!.positional)).toBe(true);
  });
  it('does not flag a check that reads the selected state of an element found by name', () => {
    const hits = actions('test/fixtures/locked/svelte-filter-step6.ndjson').map(a => lockedFromAction(a, 6)).filter(Boolean);
    expect(hits).toEqual([]);
  });
  it('does not flag a read whose locator does not contain the expected value', () => {
    const a = { action_type: 'analyze', action_params: { expected_value: '50.00', code_js: 'el(3).textContent', locators: ['internal:testid=[data-testid="balance"s]'] } };
    expect(lockedFromAction(a, 1)).toBeNull();
  });
});
