// witness guard: run the test on the target; if it fails, run the same recording on the reference and decide.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { classify, isStale, labelDisagrees, type Decision } from '../core/classify.js';
import { buildCard, parseTestSteps } from '../core/card.js';
import type { RunSummary } from '../core/stream.js';
import { findBlindChecks, type BlindCheck } from '../core/blind.js';
import { findLockedChecks, type LockedCheck } from '../core/locked.js';
import { runKane } from '../io/kane.js';
import { serveDir } from '../io/serve.js';
import { prepareProfile } from '../io/setup.js';
import type { BuildRef, WitnessConfig } from '../io/config.js';

export interface GuardResult { test: string; decision: Decision; target: RunSummary; reference?: RunSummary; card?: string; evidenceDir: string; blind: BlindCheck[]; locked: LockedCheck[]; }

export async function open(ref: BuildRef) {
  const s = ref.url ? { url: ref.url, close: async () => {} } : ref.dir ? await serveDir(ref.dir, { isolation: ref.isolation }) : null;
  if (!s) throw new Error('a build needs url or dir');
  const prof = ref.setup ? await prepareProfile(ref.setup, s.url) : null;
  return { url: s.url, profile: prof?.dir ?? ref.profile, close: async () => { prof?.remove(); await s.close(); } };
}

export async function guard(cfg: WitnessConfig, testFile: string, log = console.log): Promise<GuardResult> {
  const id = new Date().toISOString().replace(/[:.]/g, '-');
  const evidenceDir = join(cfg.evidenceDir ?? '.witness/runs', `${id}-${basename(testFile, '.md')}`);
  mkdirSync(evidenceDir, { recursive: true });
  const locked = findLockedChecks(testFile);
  for (const l of locked) log(`  LOCKED     test step ${l.step} finds the element by its expected text ${JSON.stringify(l.expected)} (${l.locator}), so it only proves that text is somewhere on the page, not which item or where${l.positional ? ' (this step is about position, so it cannot catch a wrong order)' : ''}`);
  const tgt = await open(cfg.target);
  let target: RunSummary;
  let blind: BlindCheck[] = [];
  try {
    log(`witness  ${basename(testFile)}  target ${tgt.url}`);
    const t = await runKane({ testFile, url: tgt.url, profileTemplate: tgt.profile });
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
  const ref = await open(cfg.reference);
  let reference: RunSummary;
  try {
    log(`  reference  ${ref.url}`);
    const r = await runKane({ testFile, url: ref.url, profileTemplate: ref.profile });
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
