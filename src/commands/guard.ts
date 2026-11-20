// witness guard: run the test on the target; if it fails, run the same recording on the reference and decide.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import { classify, isStale, labelDisagrees, type Decision } from '../core/classify.js';
import { buildCard, parseTestSteps } from '../core/card.js';
import type { RunSummary } from '../core/stream.js';
import { findBlindChecks, type BlindCheck } from '../core/blind.js';
import { findLockedChecks, findLooseChecks, type LockedCheck } from '../core/locked.js';
import { runKane } from '../io/kane.js';
import { serveDir } from '../io/serve.js';
import { prepareProfile } from '../io/setup.js';
import type { BuildRef, WitnessConfig } from '../io/config.js';
import { resolveBuild } from '../io/reference.js';
import { record } from './record.js';

export interface GuardResult { test: string; decision: Decision; target: RunSummary; reference?: RunSummary; card?: string; evidenceDir: string; blind: BlindCheck[]; locked: LockedCheck[]; }

export async function open(ref: BuildRef, cacheDir = '.witness/builds') {
  ref = await resolveBuild(ref, cacheDir);
  if (ref.kane) return { url: `${ref.kane.target}: ${ref.kane.app}`, mobile: ref.kane, profile: undefined, close: async () => {} };
  const s = ref.url ? { url: ref.url, close: async () => {} } : ref.dir ? await serveDir(ref.dir, { isolation: ref.isolation }) : null;
  if (!s) throw new Error('a build needs url or dir');
  const prof = ref.setup ? await prepareProfile(ref.setup, s.url) : null;
  return { url: s.url, mobile: undefined, profile: prof?.dir ?? ref.profile, close: async () => { prof?.remove(); await s.close(); } };
}

export interface GuardOptions { recordMissing?: boolean; }

const hasRecording = (testFile: string) => existsSync(join(dirname(testFile), `output-${basename(testFile).replace(/_test\.md$/, '')}`, '.internal'));

export async function guard(cfg: WitnessConfig, testFile: string, log = console.log, opts: GuardOptions = {}): Promise<GuardResult> {
  if (!hasRecording(testFile)) {
    if (!opts.recordMissing) return noRecording(cfg, testFile, log, `${basename(testFile)} has no saved Kane recording here, so a run would record it (about 50 credits) instead of replaying it.`, 'Run witness record, or guard --record-missing.');
    log(`  recording  ${basename(testFile)} once on the reference build (no saved recording here)`);
    const rec = await record(cfg, testFile, log);
    if (!rec.ok) return noRecording(cfg, testFile, log, 'The new recording does not replay on the reference build (see UNSTABLE above).', 'Reword the step named above and record again.');
  }
  let r = await guardOnce(cfg, testFile, log);
  if (r.decision.verdict === 'STALE' && opts.recordMissing) {
    log('  recording  again on the reference build: this recording cannot be replayed here (another account, or out of date)');
    const rec2 = await record(cfg, testFile, log);
    if (rec2.ok) r = await guardOnce(cfg, testFile, log);
  }
  return r;
}

function noRecording(cfg: WitnessConfig, testFile: string, log: (s: string) => void, why: string, next: string): GuardResult {
  const evidenceDir = join(cfg.evidenceDir ?? '.witness/runs', `${new Date().toISOString().replace(/[:.]/g, '-')}-${basename(testFile, '.md')}`);
  mkdirSync(evidenceDir, { recursive: true });
  const decision: Decision = { verdict: 'NO_RECORDING', why, next, kaneLabel: null, kaneConfidence: null };
  log(`  VERDICT    NO_RECORDING: ${why}\n  next       ${next}`);
  writeFileSync(join(evidenceDir, 'decision.json'), JSON.stringify({ test: testFile, decision }, null, 2));
  const target = { status: 'unknown', stepsTotal: null, stepsPassed: null, healed: false, failed: null, creditsReported: 0, replayDecisions: null, authorDecisions: null } as RunSummary;
  return { test: testFile, decision, target, evidenceDir, blind: [], locked: [] };
}

async function guardOnce(cfg: WitnessConfig, testFile: string, log = console.log): Promise<GuardResult> {
  const id = new Date().toISOString().replace(/[:.]/g, '-');
  const evidenceDir = join(cfg.evidenceDir ?? '.witness/runs', `${id}-${basename(testFile, '.md')}`);
  mkdirSync(evidenceDir, { recursive: true });
  const locked = findLockedChecks(testFile);
  for (const l of findLooseChecks(testFile)) log(`  LOOSE      test step ${l.step}: "${l.query}" has an expected value (${JSON.stringify(l.expected)}) but no code to read the page; a replay cannot check it`);
  for (const l of locked) log(l.kind === 'read'
    ? `  LOCKED     test step ${l.step} only extracts its expected text ${JSON.stringify(l.expected)} (${l.locator}), so on a wrong value it reads None, never what the page shows: Kane's triage and an agent cannot see the wrong value`
    : `  LOCKED     test step ${l.step} finds the element by its expected text ${JSON.stringify(l.expected)} (${l.locator}), so it only proves that text is somewhere on the page, not which item or where${l.positional ? ' (this step is about position, so it cannot catch a wrong order)' : ''}`);
  const tgt = await open(cfg.target, cfg.cacheDir);
  let target: RunSummary;
  let blind: BlindCheck[] = [];
  try {
    log(`witness  ${basename(testFile)}  target ${tgt.url}`);
    let t = await runKane({ testFile, url: tgt.url, mobile: tgt.mobile, profileTemplate: tgt.profile });
    if (t.summary.status === 'failed' && t.summary.failed?.kind === 'action' && (t.summary.authorDecisions ?? 0) === 0) {
      // A click or typing step can fail when the machine is busy. Replay once more before calling it a test problem.
      writeFileSync(join(evidenceDir, 'target-first-try.ndjson'), t.ndjson);
      log(`  target     failed at an action (${t.summary.failed.reason}); replaying once more`);
      t = await runKane({ testFile, url: tgt.url, mobile: tgt.mobile, profileTemplate: tgt.profile });
    }
    writeFileSync(join(evidenceDir, 'target.ndjson'), t.ndjson);
    target = t.summary;
    blind = findBlindChecks(t.ndjson);
  } finally { await tgt.close(); }
  log(`  target     ${target.status.toUpperCase()}${target.failed ? ` at test step ${Number(target.failed.runId.replace('run-', '')) + 1} (${target.failed.kind})` : ''}`);
  for (const b of blind) log(`  BLIND      test step ${Number(b.runId.replace('run-', '')) + 1} passed reading ${JSON.stringify(b.value)}: ${b.reason}`);
  if (target.status === 'passed' || isStale(target)) {
    const decision = classify(target, target);
    writeFileSync(join(evidenceDir, 'decision.json'), JSON.stringify({ test: testFile, decision, blind, locked }, null, 2));
    if (decision.verdict === 'STALE') log(`  VERDICT    STALE: ${decision.why}\n  next       ${decision.next}`);
    else log(`  VERDICT    PASS${blind.length ? ' (with blind checks: harden those steps)' : ''}`);
    return { test: testFile, decision, target, evidenceDir, blind, locked };
  }
  const ref = await open(cfg.reference, cfg.cacheDir);
  let reference: RunSummary;
  try {
    log(`  reference  ${ref.url}`);
    const r = await runKane({ testFile, url: ref.url, mobile: ref.mobile, profileTemplate: ref.profile });
    writeFileSync(join(evidenceDir, 'reference.ndjson'), r.ndjson);
    reference = r.summary;
  } finally { await ref.close(); }
  const decision = classify(target, reference);
  log(`  reference  ${reference.status.toUpperCase()}`);
  if (decision.kaneLabel) log(`  Kane label ${decision.kaneLabel} ${decision.kaneConfidence ?? ''}${labelDisagrees(decision) ? '   <- disagrees with the comparison' : ''}`);
  log(`  VERDICT    ${decision.verdict}: ${decision.why}`);
  log(`  next       ${decision.next}`);
  const card = buildCard({ testName: basename(testFile), steps: parseTestSteps(readFileSync(testFile, 'utf8')), target, decision, targetUrl: cfg.target.url ?? relative(process.cwd(), cfg.target.dir ?? ''), referenceUrl: cfg.reference.url ?? relative(process.cwd(), cfg.reference.dir ?? ''), spec: cfg.spec });
  writeFileSync(join(evidenceDir, 'card.md'), card);
  writeFileSync(join(evidenceDir, 'decision.json'), JSON.stringify({ test: testFile, decision, target, reference, blind, locked }, null, 2));
  log(`  evidence   ${evidenceDir}`);
  return { test: testFile, decision, target, reference, card, evidenceDir, blind, locked };
}
