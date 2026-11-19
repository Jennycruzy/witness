// Reads the NDJSON stream that `kane-cli testmd run --agent` prints and summarises one run.

export type StepKind = 'check' | 'action' | 'unknown';

export interface KaneLabel {
  family: string | null;
  category: string | null;
  confidence: number | null;
  rootCause: string | null;
}

export interface FailedStep {
  runId: string;
  stepIndex: number | null;
  kind: StepKind;
  reason: string;
  label: KaneLabel;
  screenshot: string | null;
}

export interface RunSummary {
  status: 'passed' | 'failed' | 'unknown';
  stepsTotal: number | null;
  stepsPassed: number | null;
  healed: boolean;
  failed: FailedStep | null;
  creditsReported: number;
  replayDecisions: number | null;  // steps Kane replayed from the saved recording
  authorDecisions: number | null;  // steps Kane recorded again instead (costs credits, and is not the saved test)
}

/** Decide whether a failure happened while checking something or while acting on the page. */
export function stepKindFromReason(reason: string): StepKind {
  const r = reason.toLowerCase();
  if (r.startsWith('assertion_failed') || r.includes('verification failed') || r.includes('assertion')) return 'check';
  if (r.startsWith('action_failed') || /\b(click|type|fill|navigate|scroll|select|press)\b/.test(r)) return 'action';
  return 'unknown';
}

function stepIndexFromReason(reason: string): number | null {
  const m = reason.match(/@\s*step\s+(\d+)/i);
  return m ? Number(m[1]) : null;
}

export function parseRun(ndjson: string): RunSummary {
  const summary: RunSummary = { status: 'unknown', stepsTotal: null, stepsPassed: null, healed: false, failed: null, creditsReported: 0, replayDecisions: null, authorDecisions: null };
  for (const line of ndjson.split('\n')) {
    const t = line.trim();
    if (!t.startsWith('{')) continue;
    let ev: any;
    try { ev = JSON.parse(t); } catch { continue; }
    if (ev.type === 'run_end') {
      if (typeof ev.credits_consumed === 'number') summary.creditsReported += ev.credits_consumed;
      else if (typeof ev.verdict?.credits_consumed === 'number') summary.creditsReported += ev.verdict.credits_consumed;  // a replay reports only the triage cost, inside its verdict
      if (ev.status === 'failed' && !summary.failed) {
        const reason = String(ev.reason ?? '');
        const v = ev.verdict ?? {};
        summary.failed = {
          runId: String(ev.run_id ?? ''),
          stepIndex: stepIndexFromReason(reason),
          kind: stepKindFromReason(reason),
          reason,
          label: {
            family: v.family ?? null,
            category: v.category ?? null,
            confidence: typeof v.confidence === 'number' ? v.confidence : null,
            rootCause: v.root_cause ?? null,
          },
          screenshot: ev.screenshot_path ?? null,
        };
      }
    }
    if (ev.type === 'test_md_summary') {
      summary.status = ev.overall_status === 'passed' ? 'passed' : ev.overall_status === 'failed' ? 'failed' : 'unknown';
      summary.stepsTotal = ev.steps?.total ?? null;
      summary.stepsPassed = ev.steps?.passed ?? null;
      summary.healed = Boolean(ev.adaptive_heal?.triggered);
      summary.replayDecisions = typeof ev.steps?.replay_decisions === 'number' ? ev.steps.replay_decisions : null;
      summary.authorDecisions = typeof ev.steps?.author_decisions === 'number' ? ev.steps.author_decisions : null;
    }
  }
  if (summary.status === 'unknown' && summary.failed) summary.status = 'failed';
  return summary;
}
