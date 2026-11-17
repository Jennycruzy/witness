import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseRun } from '../src/core/stream.js';
import { classify } from '../src/core/classify.js';
import { buildCard, failedTestStep, parseTestSteps } from '../src/core/card.js';

const fx = (n: string) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');

const testMd = `---
mode: testing
url: http://127.0.0.1:5191/
---

# Editing a todo trims the text and removes empty todos

## Add two todos
Type "a" in the new todo box and press Enter, then type "b" and press Enter.

## Clear the first todo by editing
Double-click the todo "a", replace its text with three spaces and press Enter.

## Check the empty todo is gone
Verify the todo list shows exactly one todo, "b".
`;

describe('card for the coding agent', () => {
  it('reads the steps of a Kane test file', () => {
    const steps = parseTestSteps(testMd);
    expect(steps.map(s => s.title)).toEqual(['Add two todos', 'Clear the first todo by editing', 'Check the empty todo is gone']);
    expect(steps[2].body).toBe('Verify the todo list shows exactly one todo, "b".');
  });

  it('marks the step Kane failed and tells the agent to fix the app on an app bug', () => {
    const target = parseRun(fx('todomvc-2315-edit-target-svelte.ndjson'));
    const reference = parseRun(fx('todomvc-2315-edit-reference-vue.ndjson'));
    const d = classify(target, reference);
    expect(failedTestStep(target)).toBe(5);
    const card = buildCard({ testName: 'edit_trim_test.md', steps: parseTestSteps(fx('edit_trim_test.md')), target, decision: d, targetUrl: 'svelte', referenceUrl: 'vue' });
    expect(card).toContain('WITNESS verdict: APP_BUG');
    expect(card).toContain('5. Check the text is trimmed');
    expect(card).toContain('<-- FAILED HERE');
    expect(card).toContain('Change only the application source');
    expect(card).toContain('Kane\'s own label was "automation_bug"');
  });

  it('never sends the agent to the app on a test problem', () => {
    const target = parseRun(fx('actual-layout-target-26.7.0.ndjson'));
    const reference = parseRun(fx('actual-layout-reference-26.8.0.ndjson'));
    const card = buildCard({ testName: 'running_balance_test.md', steps: [], target, decision: classify(target, reference), targetUrl: 't', referenceUrl: 'r' });
    expect(card).toContain('TEST_PROBLEM');
    expect(card).not.toContain('Change only the application source');
  });
});
