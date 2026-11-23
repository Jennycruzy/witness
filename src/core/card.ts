// Builds the message a coding agent receives after a verdict. Only facts from Kane's own output and the test file.
import type { Decision } from './classify.js';
import type { RunSummary } from './stream.js';

export interface TestStep { title: string; body: string; }

/** Steps of a Kane _test.md: each "## heading" and the text under it. */
export function parseTestSteps(markdown: string): TestStep[] {
  const steps: TestStep[] = [];
  const body = markdown.replace(/^---[\s\S]*?---\s*/, '');
  let cur: TestStep | null = null;
  for (const line of body.split('\n')) {
    const m = line.match(/^##\s+(.*)$/);
    if (m) { if (cur) steps.push(cur); cur = { title: m[1].trim(), body: '' }; continue; }
    if (cur && line.trim() && !line.startsWith('# ')) cur.body += (cur.body ? ' ' : '') + line.trim();
  }
  if (cur) steps.push(cur);
  return steps;
}

/** Kane numbers runs from run-0, one per test step. */
export function failedTestStep(target: RunSummary): number | null {
  const m = target.failed?.runId.match(/run-(\d+)/);
  return m ? Number(m[1]) + 1 : null;
}

export function buildCard(o: { testName: string; steps: TestStep[]; target: RunSummary; decision: Decision; targetUrl: string; referenceUrl: string; spec?: string }): string {
  const n = failedTestStep(o.target);
  const lines: string[] = [];
  lines.push(`WITNESS verdict: ${o.decision.verdict}. ${o.decision.why}`);
  lines.push(`What to do: ${o.decision.next}`);
  if (o.decision.kaneLabel) lines.push(`Kane's own label was "${o.decision.kaneLabel}"${o.decision.kaneConfidence != null ? ` (${o.decision.kaneConfidence})` : ''}. It is not used to decide; the comparison is.`);
  lines.push('', `Test: ${o.testName}`);
  o.steps.forEach((s, i) => lines.push(`${i + 1}. ${s.title}: ${s.body}${n === i + 1 ? '   <-- FAILED HERE' : ''}`));
  const rc = o.target.failed?.label.rootCause;
  if (rc) lines.push('', `What Kane saw: ${rc}`);
  lines.push('', `Target build: ${o.targetUrl}   Reference build: ${o.referenceUrl}`);
  if (o.decision.verdict === 'APP_BUG' || o.decision.verdict === 'STATE_BUG') lines.push('Change only the application source. Do not edit tests, recordings or build config.');
  if (o.spec) lines.push('', `Spec: ${o.spec}`);
  lines.push('', 'When done, say which file and lines you changed and why.');
  return lines.join('\n');
}
