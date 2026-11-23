// witness demo: walks through one real case from the committed Kane runs, then recomputes every number.
// No Kane login, no credits, no network. Everything printed comes from evidence/ and test/fixtures/.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseRun } from '../core/stream.js';
import { classify, classifyCarried } from '../core/classify.js';
import { buildCard, failedTestStep, parseTestSteps } from '../core/card.js';
import { findBlindChecks } from '../core/blind.js';
import { lockedFromAction } from '../core/locked.js';
import { verify } from './verify.js';

/** The folder that holds evidence/: the current folder in a clone, else the installed package. */
export function evidenceRoot(cwd = process.cwd()): string {
  if (existsSync(join(cwd, 'evidence/cases.json'))) return cwd;
  return resolve(dirname(fileURLToPath(import.meta.url)), '../..');
}

const tty = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code: string) => (s: string) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = c('1'), dim = c('2'), red = c('31'), green = c('32'), yellow = c('33');

export function demo(root = evidenceRoot(), log = console.log): number {
  const read = (p: string) => readFileSync(join(root, p), 'utf8');
  const cases = JSON.parse(read('evidence/cases.json'));
  const pair = cases.pairs.find((p: any) => /2315-edit-target-svelte\.ndjson$/.test(p.target));
  const fixCase = cases.fixes.find((f: any) => /2315-edit-fixed-svelte\.ndjson$/.test(f.run));
  const target = parseRun(read(pair.target));
  const reference = parseRun(read(pair.reference));
  const d = classify(target, reference);
  const steps = parseTestSteps(read('test/fixtures/edit_trim_test.md'));
  const n = failedTestStep(target);

  log(bold('WITNESS demo') + dim('  real Kane CLI runs from evidence/; no login, no credits, no network'));
  log('');
  log(bold('1. A Kane test fails on a real bug'));
  log(`   App: TodoMVC Svelte, open issue ${pair.issue}`);
  log(`   Test (plain English, ${steps.length} steps): "${steps[n ? n - 1 : 0].title}" fails at step ${n}.`);
  if (target.failed?.label.rootCause) log(dim(`   Kane saw: ${target.failed.label.rootCause}`));
  log(`   Kane's label: ${red(String(d.kaneLabel))} (confidence ${d.kaneConfidence}) ${dim('= "the test is wrong"')}`);
  log(`   An agent that trusts that label edits the test until it accepts the bug.`);
  log('');
  log(bold('2. WITNESS replays the same recording on a second build'));
  log(`   reference  ${pair.reference_build.padEnd(42)} ${green(reference.status.toUpperCase())}`);
  log(`   target     ${pair.target_build.padEnd(42)} ${red(target.status.toUpperCase())} at a check (step ${n})`);
  log(`   VERDICT    ${bold(d.verdict === 'APP_BUG' ? red(d.verdict) : d.verdict)}: ${d.why}`);
  log('');
  log(bold('3. The card the coding agent gets'));
  const card = buildCard({ testName: 'edit_trim_test.md', steps, target, decision: d, targetUrl: 'svelte build', referenceUrl: 'vue build' });
  for (const line of card.split('\n')) log(dim('   | ') + line);
  log('');
  log(bold('4. The agent changed the app, not the test') + dim(`  (${fixCase.diff})`));
  for (const line of read(fixCase.diff).split('\n')) {
    if (/^[-+](?![-+])/.test(line)) log('   ' + (line.startsWith('+') ? green(line) : red(line)));
  }
  const fixed = parseRun(read(fixCase.run));
  const proven = fixed.status === 'passed' && !fixed.healed && (fixed.authorDecisions ?? 0) === 0;
  log(`   Rebuilt app, UNCHANGED recording: ${proven ? green('PASSED') : red(fixed.status.toUpperCase())} ${fixed.replayDecisions ?? '?'}/${fixed.stepsTotal} steps replayed, none recorded again, no self-healing.`);
  log('');
  log(bold('5. Two checks Kane passed that could not see the bug'));
  const blind = findBlindChecks(read(cases.blind.runs[0]))[0];
  if (blind) log(`   ${yellow('BLIND')}   "exactly one todo, b" passed reading ${JSON.stringify(blind.value)}: ${blind.reason}.`);
  const l = cases.locked?.[0];
  if (l) {
    const hit = read(l.recording).split('\n').filter(Boolean).map(x => lockedFromAction(JSON.parse(x), 0)).find(Boolean);
    if (hit) log(`   ${yellow('LOCKED')}  "${hit.query}" finds the todo by the text it expects (${hit.expected}), so it cannot see the order. Real bug: ${l.issue}`);
  }
  log('');
  const cs = cases.carried?.[0];
  if (cs) {
    log(bold('6. A bug a clean test run cannot see') + dim(`  (${cs.issue}, ${cs.kane})`));
    const [t, cl, r] = [cs.target, cs.clean, cs.reference].map((f: string) => parseRun(read(f)));
    const d = classifyCarried(t, cl, r);
    const T = cs.target_short ?? cs.target_build, R = cs.reference_short ?? cs.reference_build;
    log(`   ${T}, clean browser (what Kane does):    ${cl.status === 'passed' ? green('PASSED') : red(cl.status.toUpperCase())}, the bug is missed`);
    log(`   ${T}, with the data ${R} saved:  ${t.status === 'passed' ? green('PASSED') : red(`FAILED at a ${t.failed?.kind}`)}`);
    log(`   ${R}, with the data it saved:                ${r.status === 'passed' ? green('PASSED') : red(r.status.toUpperCase())}`);
    log(`   Kane saw: "${t.failed?.label.rootCause ?? ''}"`);
    log(`   WITNESS: ${red(d.verdict)}. ${d.why}`);
    log('');
  }
  log(bold(`${cs ? 7 : 6}. Every number, recomputed from the committed runs`));
  const code = verify(root, {}, (s: string) => log('   ' + s.replace(/\n/g, '\n   ')));
  log('');
  log(dim('Next: run it on your own app with a Kane login. README: https://github.com/Jennycruzy/witness'));
  return code;
}
