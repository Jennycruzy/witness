#!/usr/bin/env node
// witness guard [witness.json]          run each test on the target; on failure compare with the reference
// witness fix <test> [witness.json]     app bug -> agent fix -> rebuild -> prove with the unchanged recording
// witness record <test> [witness.json]   record the test's steps with Kane on the reference build (or newest release)
// witness classify <target.ndjson> <reference.ndjson>   decide from two saved Kane runs
// witness mine plan|run <mine.json>     merged bug fixes -> agent-written Kane tests -> kept when fixed passes and buggy fails
// witness pr list|check|watch <pr.json> [n]   open pull requests of a real app: Kane replays saved tests on each live preview
// witness bench register|run|score <cases.json>   the triage bench: pre-registered answers, Kane's label vs WITNESS
// witness demo                           one real case from the committed runs, then every number recomputed (no login)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { parseRun } from './core/stream.js';
import { classify, labelDisagrees } from './core/classify.js';
import { loadConfig } from './io/config.js';
import { guard } from './commands/guard.js';
import { fix } from './commands/fix.js';
import { pinTests, pinsPath, stopHook } from './commands/hook.js';
import { teach } from './commands/teach.js';
import { watch } from './commands/watch.js';
import { search } from './commands/search.js';
import { listVersions } from './io/npm.js';
import { verify } from './commands/verify.js';
import { record } from './commands/record.js';
import { demo, evidenceRoot } from './commands/demo.js';
import { renderReport } from './core/report.js';
import { exportSite, startLive } from './commands/live.js';
import { minePlan, mineRun, summarize, loadMine } from './commands/mine.js';
import { checkPr, listOpenPrs, loadPrConfig, watchPrs } from './commands/pr.js';
import { register, runBench, scoreAll } from './commands/bench.js';

const [cmd, a, b] = process.argv.slice(2);

async function main(): Promise<number> {
  if (cmd === 'classify' && a && b) {
    const target = parseRun(readFileSync(a, 'utf8'));
    const reference = parseRun(readFileSync(b, 'utf8'));
    const d = classify(target, reference);
    console.log(`  reference  ${reference.status.toUpperCase()}`);
    console.log(`  target     ${target.status.toUpperCase()}${target.failed ? ` (${target.failed.kind})` : ''}`);
    if (d.kaneLabel) console.log(`  Kane label ${d.kaneLabel} ${d.kaneConfidence ?? ''}${labelDisagrees(d) ? '   <- disagrees with the comparison' : ''}`);
    console.log(`  VERDICT    ${d.verdict}: ${d.why}`);
    console.log(`  next       ${d.next}`);
    return d.verdict === 'APP_BUG' || d.verdict === 'TEST_PROBLEM' ? 2 : 0;
  }
  if (cmd === 'mine' && (a === 'plan' || a === 'run' || a === 'summary') && b) {
    // witness mine plan|run|summary <mine.json> [--only <pr>]
    const oi = process.argv.indexOf('--only');
    if (a === 'plan') await minePlan(b);
    else if (a === 'run') await mineRun(b, console.log, oi > 0 ? process.argv[oi + 1] : undefined);
    else summarize(loadMine(b).outDir);
    return 0;
  }
  if (cmd === 'bench' && a && b) {
    // witness bench register <cases.json>          hash the cases and their answers (commit that before any run)
    // witness bench run <cases.json> <label> [--only id,id]   replay every case with the Kane on PATH; resumable
    // witness bench score <cases.json>             Kane's label and WITNESS's verdict against the answers, per run
    if (a === 'register') { console.log(JSON.stringify(register(b), null, 2)); return 0; }
    if (a === 'run') {
      const oi = process.argv.indexOf('--only');
      const s = await runBench(b, process.argv[5], console.log, oi > 0 ? process.argv[oi + 1].split(',') : undefined);
      console.log(JSON.stringify(s, null, 2));
      return 0;
    }
    if (a === 'score') { scoreAll(b); return 0; }
  }
  if (cmd === 'pr' && a === 'watch' && b) {
    // witness pr watch <pr.json> [--max n] [--plan]: check every open pull request whose newest commit has not been checked yet
    const mi = process.argv.indexOf('--max');
    // --plan prints "<number> <tests>" per pull request to check and runs nothing (for a scheduler that runs each check on its own)
    const plan = process.argv.includes('--plan') ? (n: number, t: string) => console.log(`${n} ${t}`) : undefined;
    const r = await watchPrs(loadPrConfig(b), plan ? () => {} : console.log, mi > 0 ? Number(process.argv[mi + 1]) : 10, { plan });
    if (plan) return 0;
    return r.checked.some(x => x.results.some(y => y.verdict === 'APP_BUG')) ? 2 : 0;
  }
  if (cmd === 'pr' && (a === 'list' || a === 'check') && b) {
    // witness pr list <pr.json>                 open pull requests and their live previews
    // witness pr check <pr.json> <n> [--only a,b] Kane replays the saved tests (or only those named) on the preview of pull request n
    const c = loadPrConfig(b);
    if (a === 'list') {
      for (const p of listOpenPrs(c)) console.log(`#${p.number}  ${p.preview ? 'preview' : 'no preview'}  ${p.ai ? '[AI] ' : ''}${p.title.replace(/^\s*\[AI\]\s*/i, '')}`);
      return 0;
    }
    const n = Number(process.argv[5]);
    if (!n) { console.error('usage: witness pr check <pr.json> <pull request number> [--only <test>]'); return 64; }
    const oi = process.argv.indexOf('--only');
    const r = await checkPr(c, n, console.log, oi > 0 ? process.argv[oi + 1] : undefined);
    if (process.env.WITNESS_RESULTS) writeFileSync(process.env.WITNESS_RESULTS, JSON.stringify(r, null, 2));
    return r.results.some(x => x.verdict === 'APP_BUG') ? 2 : 0;
  }
  if (cmd === 'guard') {
    // witness guard [witness.json] [--only <test name or file>]
    const args = process.argv.slice(3);
    const oi = args.indexOf('--only');
    const only = oi >= 0 ? args[oi + 1] : undefined;
    const cfgArg = args.find((x, i) => !x.startsWith('--') && (oi < 0 || i !== oi + 1));
    const cfg = loadConfig(cfgArg ?? 'witness.json');
    if (only) {
      cfg.tests = cfg.tests.filter(t => t.endsWith(only) || t.endsWith(`${only}_test.md`) || t.endsWith(`/${only}`));
      if (!cfg.tests.length) { console.error(`no test in witness.json matches ${only}`); return 64; }
    }
    let code = 0;
    const results = [];
    const recordMissing = args.includes('--record-missing');
    const carryState = args.includes('--carry-state'), teach = args.includes('--teach');
    for (const t of cfg.tests) { const r = await guard(cfg, t, console.log, { recordMissing, carryState, teach }); results.push(r); if (r.decision.verdict !== 'PASS') code = 2; }
    if (process.env.WITNESS_REPORT) writeFileSync(process.env.WITNESS_REPORT, renderReport(results));
    if (process.env.WITNESS_RESULTS) writeFileSync(process.env.WITNESS_RESULTS, JSON.stringify(results.map(r => ({ test: r.test, verdict: r.decision.verdict, why: r.decision.why, next: r.decision.next, kaneLabel: r.decision.kaneLabel, kaneConfidence: r.decision.kaneConfidence, target: r.target.status, reference: r.reference?.status ?? null, failedStep: r.target.failed?.runId ?? null, kaneSaw: r.target.failed?.label.rootCause ?? null, replayed: r.target.replayDecisions, recordedAgain: r.target.authorDecisions, credits: (r.target.creditsReported ?? 0) + (r.reference?.creditsReported ?? 0), card: r.card ?? null, blind: r.blind, locked: r.locked })), null, 2));
    return code;
  }
  if (cmd === 'fix' && a) {
    const cfg = loadConfig(b ?? 'witness.json');
    const r = await fix(cfg, resolve(a), console.log, { carryState: process.argv.includes('--carry-state') });
    return r.outcome === 'PROVEN' ? 0 : 2;
  }
  if (cmd === 'record' && a) {
    const rest = process.argv.slice(4).filter(x => !x.startsWith('--'));
    const r = await record(loadConfig(rest[0] ?? 'witness.json'), resolve(a), console.log, { carryState: process.argv.includes('--carry-state') });
    return r.ok ? 0 : 2;
  }
  if (cmd === 'teach' && a && b) {
    // witness teach <evidence dir> <test_md> [witness.json]: tell Kane's bug memory what a finished guard run decided
    const cfgPath = process.argv[5] ?? 'witness.json';
    const label = existsSync(cfgPath) ? loadConfig(cfgPath).reference.label : undefined;
    const r = await teach(resolve(a), resolve(b), label ?? 'the reference build');
    return r.bug || r.why?.startsWith('no teaching') ? 0 : 2;
  }
  if (cmd === 'demo') return demo();
  if (cmd === 'verify') return verify(evidenceRoot(), { writeManifest: a === '--write-manifest' });
  if (cmd === 'watch') {
    const r = await watch(loadConfig(a ?? 'witness.json'));
    return r.results.some((x: any) => x.verdict === 'APP_BUG') ? 2 : 0;
  }
  if (cmd === 'search' && a) {
    // witness search <test_md> <from-version> <to-version> [witness.json]
    const [, , from, to, cfgPath] = process.argv.slice(2);
    const cfg = loadConfig(cfgPath ?? 'witness.json');
    if (!cfg.nightly || !from || !to) { console.error('usage: witness search <test_md> <good-version> <bad-version> [witness.json]'); return 64; }
    const all = await listVersions(cfg.nightly.npm);
    const i = all.findIndex(v => v.version === from), j = all.findIndex(v => v.version === to);
    const span = all.slice(i, j + 1).filter((v, k, arr) => k === 0 || k === arr.length - 1 || /nightly/.test(v.version));
    console.log(`search ${cfg.nightly.npm}: ${span.length} builds from ${from} (good) to ${to} (bad)`);
    const r = await search(cfg.nightly, span, resolve(a), cfg.cacheDir!);
    console.log(`  first bad ${r.firstBad}  (last good ${r.lastGood})`);
    for (const c of r.commits) console.log(`    ${c.sha} ${c.date} ${c.title}`);
    return 0;
  }
  if (cmd === 'hook') {
    const stdin = await new Promise<string>(res => { let s = ''; process.stdin.on('data', d => { s += d; }); process.stdin.on('end', () => res(s)); });
    return stopHook(stdin, 3, { carryState: process.argv.includes('--carry-state') });
  }
  if (cmd === 'live') {
    // witness live [live.json]: the Run it live page (see examples/todomvc-svelte/live.json)
    const path = resolve(a ?? 'live.json');
    const base = dirname(path);
    const c = JSON.parse(readFileSync(path, 'utf8'));
    const r = (p: string) => resolve(base, p);
    const rest = process.argv.slice(3);
    const ex = rest.indexOf('--export');
    if (ex >= 0) {
      // witness live <live.json> --export <dir> --api <url>: the site's pages as static files (for Vercel)
      const api = rest[rest.indexOf('--api') + 1];
      if (rest.indexOf('--api') < 0 || !api) throw new Error('--export needs --api <url of the witness live server>');
      const files = exportSite({ builds: Object.fromEntries(Object.entries<any>(c.builds).map(([k, v]) => [k, { dir: '', label: v.label }])), perHour: c.perHour ?? 6, perVisitorMinutes: c.perVisitorMinutes ?? 10, pr: c.pr ? { config: '', app: c.pr.app } : undefined }, resolve(rest[ex + 1]), api);
      for (const f of files) console.log(`wrote ${relative(process.cwd(), f)}`);
      return 0;
    }
    startLive({
      exampleDir: r(c.exampleDir ?? '.'), referenceDir: r(c.referenceDir), tests: c.tests,
      builds: Object.fromEntries(Object.entries<any>(c.builds).map(([k, v]) => [k, { dir: r(v.dir), label: v.label }])),
      port: Number(process.env.PORT ?? c.port ?? 8797), host: c.host ?? '127.0.0.1',
      perHour: c.perHour ?? 6, perVisitorMinutes: c.perVisitorMinutes ?? 10,
      stateFile: r(c.stateFile ?? '.witness/live-history.json'), cli: resolve(process.argv[1]),
      pr: c.pr ? { config: r(c.pr.config), app: c.pr.app } : undefined, lock: c.lock, origins: c.origins,
    });
    return new Promise<number>(() => {});
  }
  if (cmd === 'install-skill') {
    // witness install-skill [--global]: the Claude Code skill that tells an agent to act on the WITNESS verdict
    const src = resolve(evidenceRoot(), 'skills/witness/SKILL.md');
    const home = process.env.HOME ?? '.';
    const dest = a === '--global' ? resolve(home, '.claude/skills/witness/SKILL.md') : resolve('.claude/skills/witness/SKILL.md');
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, readFileSync(src, 'utf8'));
    console.log(`Installed the WITNESS skill in ${dest}`);
    return 0;
  }
  if (cmd === 'install-hook') {
    const settings = resolve('.claude/settings.json');
    mkdirSync(dirname(settings), { recursive: true });
    const cur = existsSync(settings) ? JSON.parse(readFileSync(settings, 'utf8')) : {};
    cur.hooks = cur.hooks ?? {};
    const command = `node ${JSON.stringify(resolve(process.argv[1]))} hook${a === '--carry-state' ? ' --carry-state' : ''}`;
    const already = JSON.stringify(cur.hooks.Stop ?? []).includes(' hook');
    if (!already) (cur.hooks.Stop = cur.hooks.Stop ?? []).push({ hooks: [{ type: 'command', command, timeout: 1200 }] });
    writeFileSync(settings, JSON.stringify(cur, null, 2) + '\n');
    console.log(already ? 'The WITNESS Stop hook is already installed.' : `Installed the WITNESS Stop hook in ${settings}`);
    if (existsSync('witness.json')) {
      const pins = pinTests(loadConfig(resolve('witness.json')), process.cwd());
      console.log(`Pinned ${Object.keys(pins).length} Kane test(s) and their recordings in ${pinsPath(process.cwd())}: an agent's fix only counts if they stay unchanged`);
    }
    return 0;
  }
  if (cmd === 'pin') {
    // witness pin [witness.json]: a person accepts the tests and recordings as they are now
    const cfgPath = resolve(a ?? 'witness.json');
    const pins = pinTests(loadConfig(cfgPath), dirname(cfgPath));
    for (const [t, h] of Object.entries(pins)) console.log(`  pinned ${t}  ${h.slice(0, 12)}…`);
    return 0;
  }
  console.error('usage: witness demo | witness verify | witness guard [witness.json] [--only <test>] [--record-missing] [--carry-state] [--teach] | witness teach <evidence dir> <test_md> [witness.json] | witness record <test_md> [witness.json] [--carry-state] | witness fix <test_md> [witness.json] | witness hook | witness install-skill [--global] | witness install-hook | witness pin [witness.json] | witness mine plan|run|summary <mine.json> [--only <pr>] | witness classify <target.ndjson> <reference.ndjson>');
  return 64;
}

main().then(c => process.exit(c), e => { console.error(e?.message ?? e); process.exit(1); });
