import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseRun } from '../src/core/stream.js';
import { classify, labelDisagrees } from '../src/core/classify.js';

const run = (name: string) => parseRun(readFileSync(new URL(`./fixtures/${name}.ndjson`, import.meta.url), 'utf8'));

// Real Kane runs recorded on 17 Nov 2026. Truth comes from public issues and fixes.
const cases = [
  { name: 'Actual #8475 running balance, nightly 2026-06-20 vs 2026-06-17', target: 'actual-8475-target-nightly-20260620', reference: 'actual-8475-reference-nightly-20260617', truth: 'APP_BUG', kane: 'application_issue' },
  { name: 'TodoMVC #2315 blank edit kept, svelte vs vue', target: 'todomvc-2315-edit-target-svelte', reference: 'todomvc-2315-edit-reference-vue', truth: 'APP_BUG', kane: 'automation_bug' },
  { name: 'TodoMVC #2315 blank edit kept, svelte vs vue (second run)', target: 'todomvc-2315-edit-target-svelte-run2', reference: 'todomvc-2315-edit-reference-vue', truth: 'APP_BUG', kane: 'automation_bug' },
  { name: 'TodoMVC #2315 filter not restored on reload, svelte vs vue', target: 'todomvc-2315-filter-target-svelte', reference: 'todomvc-2315-filter-reference-vue', truth: 'APP_BUG', kane: 'application_issue' },
  { name: 'Actual #6794 apostrophe separator, 26.1.0 vs 26.2.0', target: 'actual-6794-target-26.1.0', reference: 'actual-6794-reference-26.2.0', truth: 'APP_BUG', kane: 'automation_bug' },
  { name: 'Actual layout change, 26.8.0 recording replayed on 26.7.0', target: 'actual-layout-target-26.7.0', reference: 'actual-layout-reference-26.8.0', truth: 'TEST_PROBLEM', kane: 'automation_bug' },
  { name: 'Actual payee menu appeared during replay', target: 'actual-finance-target-26.8.0', reference: 'actual-finance-reference-26.8.0', truth: 'TEST_PROBLEM', kane: 'automation_bug' },
] as const;

describe('blame by comparison on real failures', () => {
  for (const c of cases) {
    it(c.name, () => {
      const d = classify(run(c.target), run(c.reference));
      expect(d.verdict).toBe(c.truth);
      expect(d.kaneLabel).toBe(c.kane);
    });
  }

  it('Kane\'s label disagrees with the truth on 2 of 4 distinct real app bugs', () => {
    const distinct = cases.filter(c => c.truth === 'APP_BUG' && !c.name.includes('second run'));
    const wrong = distinct.filter(c => labelDisagrees(classify(run(c.target), run(c.reference))));
    expect(distinct.length).toBe(4);
    expect(wrong.length).toBe(2);
  });

  it('the agent fix passes the unchanged recording on the rebuilt app', () => {
    const fixed = run('todomvc-2315-edit-fixed-svelte');
    expect(fixed.status).toBe('passed');
    expect(fixed.stepsPassed).toBe(5);
    expect(fixed.healed).toBe(false);
  });

  it('a real blind check: Kane passed "exactly one todo, b" while the blank todo from #2315 was on screen', () => {
    for (const f of ['todomvc-2315-edit-target-svelte', 'todomvc-2315-edit-target-svelte-run2']) {
      const lines = readFileSync(new URL(`./fixtures/${f}.ndjson`, import.meta.url), 'utf8').split('\n').filter(l => l.includes('"run_id":"run-2"') && l.includes('"type":"run_end"'));
      const ev = JSON.parse(lines[0]);
      expect(ev.status).toBe('passed');
      expect(ev.variables_out.todo_list_exactly_one_b_check.value).toBe('\nb');
    }
  });

  it('re-recording on the target turns the layout failure into the real check failure', () => {
    const rerecord = run('actual-layout-rerecord-26.7.0');
    expect(rerecord.failed?.kind).toBe('check');
    expect(rerecord.failed?.label.family).toBe('application_issue');
  });
});

describe('stale recording', () => {
  const run = (o: any) => ({ status: 'passed', stepsTotal: 3, stepsPassed: 3, healed: false, failed: null, creditsReported: 0, replayDecisions: 3, authorDecisions: 0, ...o });
  it('calls a target run that recorded steps again STALE, even when it passed', () => {
    expect(classify(run({ replayDecisions: 0, authorDecisions: 3 }) as any, run({}) as any).verdict).toBe('STALE');
  });
  it('accepts a reference run that made the recording', () => {
    expect(classify(run({}) as any, run({ replayDecisions: 0, authorDecisions: 3 }) as any).verdict).toBe('PASS');
  });
});
