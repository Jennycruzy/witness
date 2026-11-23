// witness verify: recompute every headline number from the committed real runs, and check each file's sha256.
// Needs no Kane login and no network.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseRun } from '../core/stream.js';
import { classify, classifyCarried, labelDisagrees } from '../core/classify.js';
import { findBlindChecks } from '../core/blind.js';
import { lockedFromAction } from '../core/locked.js';

const sha = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');

export function verify(root: string, opts: { writeManifest?: boolean } = {}, log = console.log): number {
  const cases = JSON.parse(readFileSync(join(root, 'evidence/cases.json'), 'utf8'));
  const files: string[] = [];
  for (const p of cases.pairs) files.push(p.target, p.reference, ...(p.confirm ? [p.confirm] : []));
  for (const f of cases.fixes) files.push(f.run, f.diff);
  files.push(...cases.blind.runs);
  for (const l of cases.locked ?? []) files.push(l.recording, l.run);
  for (const x of cases.sessions ?? []) files.push(x.prompt, x.transcript, x.diff);
  for (const x of cases.carried ?? []) files.push(x.target, x.clean, x.reference);
  const uniq = [...new Set(files)].sort();
  const manifestPath = join(root, 'evidence/manifest.json');
  const hashes = Object.fromEntries(uniq.map(f => [f, sha(join(root, f))]));
  if (opts.writeManifest) { writeFileSync(manifestPath, JSON.stringify(hashes, null, 2) + '\n'); log(`wrote ${manifestPath}`); }
  let ok = true;
  if (existsSync(manifestPath)) {
    const m = JSON.parse(readFileSync(manifestPath, 'utf8'));
    for (const f of uniq) if (m[f] !== hashes[f]) { ok = false; log(`CHANGED  ${f}`); }
    log(ok ? `files    ${uniq.length} evidence files match evidence/manifest.json (sha256)` : 'files    evidence differs from the manifest');
  } else { ok = false; log('files    evidence/manifest.json is missing'); }

  log('\nreal failures: truth vs Kane\'s label vs WITNESS');
  let appBugs = 0, kaneRight = 0, witnessRight = 0, testProblems = 0, witnessRightTP = 0, envs = 0, witnessRightEnv = 0;
  for (const p of cases.pairs) {
    const d = classify(parseRun(readFileSync(join(root, p.target), 'utf8')), parseRun(readFileSync(join(root, p.reference), 'utf8')));
    const kaneOk = !labelDisagrees({ ...d, verdict: p.truth });
    const wOk = d.verdict === p.truth;
    if (p.truth === 'APP_BUG') { appBugs++; if (kaneOk) kaneRight++; if (wOk) witnessRight++; } else if (p.truth === 'ENV') { envs++; if (wOk) witnessRightEnv++; } else { testProblems++; if (wOk) witnessRightTP++; }
    log(`  ${p.truth.padEnd(12)} Kane ${String(d.kaneLabel).padEnd(17)} ${p.truth === 'ENV' ? 'n/a  ' : kaneOk ? 'right' : 'WRONG'}   WITNESS ${d.verdict.padEnd(12)} ${wOk ? 'right' : 'WRONG'}   ${p.name}`);
    if (!wOk) ok = false;
  }
  log(`\n  real app bugs:      Kane's label right on ${kaneRight} of ${appBugs}; WITNESS right on ${witnessRight} of ${appBugs}`);
  log(`  real test problems: WITNESS right on ${witnessRightTP} of ${testProblems}`);
  if (envs) log(`  reference fails too: WITNESS said ENV on ${witnessRightEnv} of ${envs} (nobody told to change the app)`);

  let fixOk = true;
  for (const f of cases.fixes) {
    const fixed = parseRun(readFileSync(join(root, f.run), 'utf8'));
    const ok1 = fixed.status === 'passed' && !fixed.healed && (fixed.authorDecisions ?? 0) === 0;
    if (!ok1) fixOk = false;
    log(`  agent fix:          the unchanged recording ${ok1 ? 'PASSES' : 'does NOT pass'} on the fixed build (${fixed.replayDecisions ?? '?'}/${fixed.stepsTotal} steps replayed, none recorded again, no heal): ${f.name}`);
  }
  for (const l of cases.locked ?? []) {
    const run = parseRun(readFileSync(join(root, l.run), 'utf8'));
    const hits = readFileSync(join(root, l.recording), 'utf8').split('\n').filter(Boolean).map(x => lockedFromAction(JSON.parse(x), 0)).filter(Boolean);
    const okL = run.status === 'passed' && hits.length > 0;
    if (!okL) ok = false;
    log(`  locked check:       Kane ${run.status.toUpperCase()} a real bug; WITNESS ${hits.length ? `flagged ${hits.length} locked read(s) in the recording` : 'flagged NOTHING'}: ${l.name}`);
  }
  for (const x of cases.sessions ?? []) {
    const events = readFileSync(join(root, x.transcript), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
    const tools = events.filter(e => e.type === 'assistant').flatMap(e => e.message.content).filter((c: any) => c.type === 'tool_use');
    const results = events.filter(e => e.type === 'user').flatMap(e => e.message.content ?? []).filter((c: any) => c?.type === 'tool_result').map((c: any) => typeof c.content === 'string' ? c.content : JSON.stringify(c.content));
    const skillFirst = tools[0]?.name === 'Skill' && tools[0]?.input?.skill === 'witness';
    const verdicts = results.flatMap((t: string) => [...t.matchAll(/VERDICT +(\w+)/g)].map(m => m[1]));
    const disagreed = results.some((t: string) => /disagrees with the comparison/.test(t));
    const appOnly = readFileSync(join(root, x.diff), 'utf8').split('\n').filter(l => l.startsWith('+++ ')).every(l => l.includes('/app/src/'));
    const okS = skillFirst && verdicts[0] === 'APP_BUG' && verdicts[verdicts.length - 1] === 'PASS' && disagreed && appOnly;
    if (!okS) ok = false;
    log(`  skill session:      ${skillFirst ? 'loaded the WITNESS skill by itself' : 'did NOT load the skill first'}; verdicts ${verdicts.join(' -> ')}; Kane's label ${disagreed ? 'disagreed and was not followed' : 'agreed'}; changed ${appOnly ? 'app source only' : 'files outside the app'}: ${x.name}`);
  }
  for (const x of cases.carried ?? []) {
    const [t, c, r] = [x.target, x.clean, x.reference].map((f: string) => parseRun(readFileSync(join(root, f), 'utf8')));
    const d = classifyCarried(t, c, r);
    const okC = d.verdict === x.truth && c.status === 'passed';
    if (!okC) ok = false;
    log(`  saved data:         clean browser ${c.status.toUpperCase()} (a plain Kane run misses it); with the old build's saved data ${t.status.toUpperCase()}${t.failed ? ` at a ${t.failed.kind}` : ''}; reference ${r.status.toUpperCase()}; WITNESS ${d.verdict} ${okC ? 'right' : 'WRONG'}: ${x.name}`);
  }
  const blind = cases.blind.runs.map((r: string) => findBlindChecks(readFileSync(join(root, r), 'utf8')).length);
  log(`  blind check:        found in ${blind.filter((n: number) => n > 0).length} of ${blind.length} real runs on the buggy build`);
  if (!fixOk || blind.some((n: number) => n === 0)) ok = false;
  log(ok ? '\nverify: OK' : '\nverify: FAILED');
  return ok ? 0 : 1;
}
