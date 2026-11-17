// witness guard: run the test on the target; if it fails, run the same recording on the reference and decide.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { classify, labelDisagrees, type Decision } from '../core/classify.js';
import { buildCard, parseTestSteps } from '../core/card.js';
import type { RunSummary } from '../core/stream.js';
import { findBlindChecks, type BlindCheck } from '../core/blind.js';
import { runKane } from '../io/kane.js';
import { serveDir } from '../io/serve.js';
import type { BuildRef, WitnessConfig } from '../io/config.js';

export interface GuardResult { test: string; decision: Decision; target: RunSummary; reference?: RunSummary; card?: string; evidenceDir: string; blind: BlindCheck[]; }

async function open(ref: BuildRef) {
  if (ref.url) return { url: ref.url, close: async () => {} };
  if (ref.dir) return serveDir(ref.dir, { isolation: ref.isolation });
  throw new Error('a build needs url or dir');
}

export async function guard(cfg: WitnessConfig, testFile: string, log = console.log): Promise<GuardResult> {
  const id = new Date().toISOString().replace(/[:.]/g, '-');
  const evidenceDir = join(cfg.evidenceDir ?? '.witness/runs', `${id}-${basename(testFile, '.md')}`);
  mkdirSync(evidenceDir, { recursive: true });
  const tgt = await open(cfg.target);
  let target: RunSummary;
  let blind: BlindCheck[] = [];
  try {
    log(`witness  ${basename(testFile)}  target ${tgt.url}`);
    const t = await runKane({ testFile, url: tgt.url, profileTemplate: cfg.target.profile });
    writeFileSync(join(evidenceDir, 'target.ndjson'), t.ndjson);
    target = t.summary;
    blind = findBlindChecks(t.ndjson);
  } finally { await tgt.close(); }
  log(`  target     ${target.status.toUpperCase()}${target.failed ? ` at test step ${Number(target.failed.runId.replace('run-', '')) + 1} (${target.failed.kind})` : ''}`);
  for (const b of blind) log(`  BLIND      test step ${Number(b.runId.replace('run-', '')) + 1} passed reading ${JSON.stringify(b.value)}: ${b.reason}`);
  if (target.status === 'passed') {
    const decision = classify(target, target);
    writeFileSync(join(evidenceDir, 'decision.json'), JSON.stringify({ test: testFile, decision, blind }, null, 2));
    log(`  VERDICT    PASS${blind.length ? ' (with blind checks: harden those steps)' : ''}`);
    return { test: testFile, decision, target, evidenceDir, blind };
  }
  const ref = await open(cfg.reference);
  let reference: RunSummary;
  try {
    log(`  reference  ${ref.url}`);
    const r = await runKane({ testFile, url: ref.url, profileTemplate: cfg.reference.profile });
    writeFileSync(join(evidenceDir, 'reference.ndjson'), r.ndjson);
    reference = r.summary;
  } finally { await ref.close(); }
  const decision = classify(target, reference);
  log(`  reference  ${reference.status.toUpperCase()}`);
  if (decision.kaneLabel) log(`  Kane label ${decision.kaneLabel} ${decision.kaneConfidence ?? ''}${labelDisagrees(decision) ? '   <- disagrees with the comparison' : ''}`);
  log(`  VERDICT    ${decision.verdict}: ${decision.why}`);
  log(`  next       ${decision.next}`);
  const card = buildCard({ testName: basename(testFile), steps: parseTestSteps(readFileSync(testFile, 'utf8')), target, decision, targetUrl: cfg.target.url ?? cfg.target.dir ?? '', referenceUrl: cfg.reference.url ?? cfg.reference.dir ?? '', spec: cfg.spec });
  writeFileSync(join(evidenceDir, 'card.md'), card);
  writeFileSync(join(evidenceDir, 'decision.json'), JSON.stringify({ test: testFile, decision, target, reference, blind }, null, 2));
  log(`  evidence   ${evidenceDir}`);
  return { test: testFile, decision, target, reference, card, evidenceDir, blind };
}
