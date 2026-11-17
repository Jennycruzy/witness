// Decides who is at fault when a Kane test fails, by comparing the same recording on two builds.
// Kane's own label is recorded next to the verdict but never used to decide it.

import type { RunSummary } from './stream.js';

export type Verdict = 'PASS' | 'APP_BUG' | 'TEST_PROBLEM' | 'ENV' | 'UNKNOWN';

export interface Decision {
  verdict: Verdict;
  why: string;
  kaneLabel: string | null;
  kaneConfidence: number | null;
  next: string;
}

export function classify(target: RunSummary, reference: RunSummary): Decision {
  const label = target.failed?.label.family ?? null;
  const conf = target.failed?.label.confidence ?? null;
  const base = { kaneLabel: label, kaneConfidence: conf };

  if (target.status === 'passed') {
    return { ...base, verdict: 'PASS', why: 'Kane passed the test on the target build.', next: 'Nothing to do.' };
  }
  if (target.status !== 'failed' || !target.failed) {
    return { ...base, verdict: 'UNKNOWN', why: 'The target run did not finish with a result.', next: 'Run it again.' };
  }
  if (reference.status !== 'passed') {
    return { ...base, verdict: 'ENV', why: 'The same recording does not pass on the reference build either.', next: 'Check the environment or the reference build before changing anything.' };
  }
  if (target.failed.kind === 'check') {
    return { ...base, verdict: 'APP_BUG', why: 'The same recording passes on the reference build and fails here at a check.', next: 'Fix the app, not the test.' };
  }
  if (target.failed.kind === 'action') {
    return { ...base, verdict: 'TEST_PROBLEM', why: 'The page changed where the test acts: it failed at an action, not at a check.', next: 'Re-record the test on the target build, then run it again.' };
  }
  return { ...base, verdict: 'UNKNOWN', why: 'Could not tell whether the failure was at a check or an action.', next: 'Read the evidence.' };
}

/** True when Kane's own label points the agent at the other side from the comparison. */
export function labelDisagrees(d: Decision): boolean {
  if (!d.kaneLabel) return false;
  if (d.verdict === 'APP_BUG') return d.kaneLabel !== 'application_issue';
  if (d.verdict === 'TEST_PROBLEM') return d.kaneLabel === 'application_issue';
  return false;
}
