// witness mine: turn an app's merged bug fixes into WITNESS cases, found by machine.
//   witness mine plan <mine.json>     list merged PRs that close an issue, pick the published build before and after
//                                     each fix, and have an agent write a Kane test from the user's issue alone
//   witness mine run  <mine.json>     record each test on the fixed build, then replay it on the buggy build
// A case is kept only when the fixed build passes and the same recording fails on the buggy build (APP_BUG).
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { listFixPRs, listReleases, tagContains, type FixPR } from '../io/github.js';
import { listVersions } from '../io/npm.js';
import type { BuildRef, WitnessConfig } from '../io/config.js';
import { record } from './record.js';
import { guard } from './guard.js';

export interface MineConfig {
  repo: string;                       // owner/name on GitHub
  since: string; until: string;       // merge dates, YYYY-MM-DD
  paths?: string[];                   // the PR must change a file under one of these (the web app's source)
  skip?: string[];                    // skip a candidate whose issue or PR title mentions one of these words
  builds: { npm: string; buildDir?: string; isolation?: boolean; settleHours?: number }   // every published version (nightlies too)
        | { release: string; asset?: string; electron?: { bin: string; args?: string[] } };  // GitHub release assets (electron: a desktop app)
  setup?: string;                     // prepares app state before each run: gets {url} and {profile}
  notes?: string;                     // file: what the app looks like after setup, for the test writer
  where?: string;                     // replaces the writer's first rule (desktop Chrome on localhost), e.g. for a desktop app
  writer?: string[];                  // the agent that writes tests (prompt on stdin, answer on stdout)
  max?: number;                       // stop after this many written tests
  out?: string;                       // cases folder (default: cases/ next to mine.json)
}

interface CaseMeta {
  pr: number; issue: number; title: string; issueTitle: string; mergedAt: string; mergeSha: string;
  buggy: BuildRef; fixed: BuildRef; status: 'written' | 'not-testable' | 'no-build'; why?: string;
}

export function loadMine(path: string): MineConfig & { base: string; outDir: string } {
  const base = dirname(resolve(path));
  const c = JSON.parse(readFileSync(path, 'utf8')) as MineConfig;
  const abs = (p: string) => (isAbsolute(p) ? p : resolve(base, p));
  return { ...c, notes: c.notes && abs(c.notes), base, outDir: abs(c.out ?? 'cases') };
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'case';

/** Picks the last build published before the fix and the first one that contains it. */
export async function pickBuilds(m: MineConfig, pr: FixPR, cache: { versions?: { version: string; time: string }[]; releases?: ReturnType<typeof listReleases> }): Promise<{ buggy: BuildRef; fixed: BuildRef } | null> {
  const b = m.builds;
  if ('npm' in b) {
    cache.versions ??= await listVersions(b.npm);
    const merged = Date.parse(pr.mergedAt), settle = (b.settleHours ?? 3) * 3600e3;
    const before = cache.versions.filter(v => v.time && Date.parse(v.time) < merged).pop();
    const after = cache.versions.find(v => v.time && Date.parse(v.time) > merged + settle);
    if (!before || !after) return null;
    const ref = (version: string): BuildRef => ({ npm: b.npm, version, buildDir: b.buildDir, isolation: b.isolation, setup: m.setup, label: `${b.npm}@${version}` });
    return { buggy: ref(before.version), fixed: ref(after.version) };
  }
  cache.releases ??= listReleases(b.release);
  const merged = Date.parse(pr.mergedAt);
  const later = cache.releases.filter(r => Date.parse(r.publishedAt) > merged);
  const fixed = later.find(r => tagContains(b.release, r.tag, pr.mergeSha));
  if (!fixed) return null;
  const i = cache.releases.indexOf(fixed);
  const buggy = cache.releases.slice(0, i).reverse().find(r => !tagContains(b.release, r.tag, pr.mergeSha));
  if (!buggy) return null;
  const ref = (tag: string): BuildRef => ({ release: b.release, tag, asset: b.asset, electron: b.electron, setup: m.setup, label: `${b.release}@${tag}` });
  return { buggy: ref(buggy.tag), fixed: ref(fixed.tag) };
}

const WRITER_RULES = `You write one end-to-end browser test for Kane CLI (an AI test agent that replays recorded steps) from a user's bug report.
The test will be recorded on the FIXED build of the app and replayed on the BUGGY build. It must pass on the fixed build and fail on the buggy one.
You see the issue only, not the fix. Write the test a careful QA person would write from the report.

Rules:
- Desktop Chrome, 1920x1080, a fresh copy of the app on localhost, no network beyond the app, no login, no sync server.
- Steps are short plain-English actions a user does on screen (click, type, choose). 2 to 6 steps.
- The LAST step starts with "Verify" and names exactly one visible fact that the fixed app shows and the buggy app (per the report) does not.
  Name WHERE to read it (which field, row, cell, heading or output box) and the exact expected text, e.g.
  Verify the Output box shows "Hello". Verify the Balance cell of the "Coffee" row shows "50.00".
- No dates, times, random values, counts of unrelated items, or anything that differs between runs.
- Use only values you can derive with certainty from the report. If the report does not say what correct output looks like, say not testable.
- Say not testable if it needs: a server, account, sync, bank, file upload or download, clipboard, drag and drop, a mobile layout,
  a browser other than Chrome, a locale or time zone, a specific operating system, timing or slowness, or if the report is unclear.

Answer with ONLY one JSON object, no prose:
{"testable": true|false, "why": "<one sentence>", "title": "<test title>", "steps": [{"heading": "<2-5 words>", "text": "<instruction>"}]}`;

export function writerPrompt(m: MineConfig, pr: FixPR): string {
  const notes = m.notes && existsSync(m.notes) ? readFileSync(m.notes, 'utf8') : '';
  const iss = pr.issues.map(i => `Issue #${i.number}: ${i.title}\n\n${i.body.slice(0, 5000)}`).join('\n\n---\n\n');
  const rules = m.where ? WRITER_RULES.replace(/^- Desktop Chrome.*$/m, `- ${m.where}`) : WRITER_RULES;
  return `${rules}\n\nTHE APP (state when your first step starts):\n${notes}\n\nTHE BUG REPORT:\n${iss}\n`;
}

async function runWriter(cmd: string[], prompt: string): Promise<any> {
  const out = await new Promise<string>((res, rej) => {
    const p = spawn(cmd[0], cmd.slice(1), { stdio: ['pipe', 'pipe', 'pipe'] });
    let buf = '', err = '';
    p.stdout.on('data', d => { buf += d; }); p.stderr.on('data', d => { err += d; });
    p.on('close', c => (c === 0 ? res(buf) : rej(new Error(`writer exit ${c}: ${err.slice(0, 300)}`))));
    p.stdin.end(prompt);
  });
  const j = out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1);
  return JSON.parse(j);
}

export function renderTest(title: string, steps: { heading: string; text: string }[]): string {
  return `---\nmode: testing\nurl: http://127.0.0.1:1/\nmax_steps: 25\n---\n\n# ${title}\n\n${steps.map(s => `## ${s.heading}\n${s.text}`).join('\n\n')}\n`;
}

export async function minePlan(path: string, log = console.log) {
  const m = loadMine(path);
  const writer = m.writer ?? ['claude', '-p', '--output-format', 'text'];
  mkdirSync(m.outDir, { recursive: true });
  const prs = listFixPRs(m.repo, m.since, m.until);
  log(`mine     ${m.repo}: ${prs.length} merged PRs that close an issue (${m.since}..${m.until})`);
  const skipRe = m.skip?.length ? new RegExp(`\\b(${m.skip.join('|')})`, 'i') : null;
  const cache = {};
  let written = 0;
  for (const pr of prs) {
    if (written >= (m.max ?? 40)) break;
    const dir = join(m.outDir, String(pr.number));
    if (existsSync(join(dir, 'case.json'))) { if (JSON.parse(readFileSync(join(dir, 'case.json'), 'utf8')).status === 'written') written++; continue; }
    const issues = pr.issues.filter(i => !i.labels.some(l => /feature|enhancement|documentation|question/i.test(l)));
    if (!issues.length) continue;
    if (m.paths && !pr.files.some(f => m.paths!.some(p => f.startsWith(p)))) continue;
    const titles = [pr.title, ...issues.map(i => i.title)].join(' ');
    if (skipRe?.test(titles)) continue;
    const builds = await pickBuilds(m, pr, cache);
    const meta: CaseMeta = { pr: pr.number, issue: issues[0].number, title: pr.title, issueTitle: issues[0].title, mergedAt: pr.mergedAt, mergeSha: pr.mergeSha,
      buggy: builds?.buggy ?? {}, fixed: builds?.fixed ?? {}, status: 'no-build' };
    mkdirSync(dir, { recursive: true });
    if (!builds) { meta.why = 'no published build before and after the fix'; writeFileSync(join(dir, 'case.json'), JSON.stringify(meta, null, 2)); continue; }
    let ans: any;
    try { ans = await runWriter(writer, writerPrompt(m, { ...pr, issues })); }
    catch (e: any) { log(`  #${pr.number}  writer failed: ${e.message}`); continue; }
    if (!ans.testable || !Array.isArray(ans.steps) || !ans.steps.length || !/^verify/i.test(ans.steps.at(-1).text)) {
      meta.status = 'not-testable'; meta.why = ans.why ?? 'no final Verify step';
      writeFileSync(join(dir, 'case.json'), JSON.stringify(meta, null, 2));
      log(`  #${pr.number}  not testable: ${meta.why}`);
      continue;
    }
    const test = `${slug(ans.title)}_test.md`;
    writeFileSync(join(dir, test), renderTest(ans.title, ans.steps));
    const cfg = { tests: [test], target: meta.buggy, reference: meta.fixed, evidenceDir: 'runs', cacheDir: '../.builds' };
    writeFileSync(join(dir, 'witness.json'), JSON.stringify(cfg, null, 2));
    meta.status = 'written'; meta.why = ans.why;
    writeFileSync(join(dir, 'case.json'), JSON.stringify(meta, null, 2));
    written++;
    log(`  #${pr.number}  test written: ${ans.title}  (buggy ${meta.buggy.label}, fixed ${meta.fixed.label})`);
  }
  log(`mine     ${written} tests written in ${m.outDir}`);
}

export interface MineResult { pr: number; issue: number; result: 'KEPT' | 'MISSED' | 'UNRECORDABLE' | string; verdict?: string; kaneLabel?: string | null; kaneConfidence?: number | null; why: string; credits?: number; at: string; }

export async function mineRun(path: string, log = console.log, only?: string) {
  const m = loadMine(path);
  const { loadConfig } = await import('../io/config.js');
  const dirs = readdirSync(m.outDir).filter(d => /^\d+$/.test(d) && existsSync(join(m.outDir, d, 'case.json')) && (!only || d === only)).sort((a, b) => Number(a) - Number(b));
  for (const d of dirs) {
    const dir = join(m.outDir, d);
    const meta: CaseMeta = JSON.parse(readFileSync(join(dir, 'case.json'), 'utf8'));
    if (meta.status !== 'written') continue;
    if (existsSync(join(dir, 'result.json')) && JSON.parse(readFileSync(join(dir, 'result.json'), 'utf8')).result !== 'ERROR') continue;
    const cfg: WitnessConfig = loadConfig(join(dir, 'witness.json'));
    // setup commands are written relative to mine.json, so the cases folder works on any machine
    for (const b of [cfg.reference, cfg.target]) if (b.setup) b.setup = b.setup.replace(/(^|\s)([^\s{}]+\.(?:m?js|sh))(?=\s|$)/g, (_, sp, f) => sp + (isAbsolute(f) ? f : resolve(m.base, f)));
    const test = cfg.tests[0];
    log(`\nmine     #${meta.pr} (issue #${meta.issue}) ${meta.issueTitle}`);
    const res: MineResult = { pr: meta.pr, issue: meta.issue, result: 'UNRECORDABLE', why: '', at: new Date().toISOString() };
    try {
      const rec = await record(cfg, test, log);
      if (!rec.ok) {
        res.why = rec.unstable ? 'the recording does not replay on the fixed build' : `the fixed build fails the test: ${rec.summary.failed?.label.rootCause ?? rec.summary.failed?.reason ?? rec.summary.status}`;
      } else {
        const g = await guard(cfg, test, log);
        res.verdict = g.decision.verdict; res.kaneLabel = g.decision.kaneLabel; res.kaneConfidence = g.decision.kaneConfidence;
        res.credits = (g.target.creditsReported ?? 0) + (g.reference?.creditsReported ?? 0);
        if (g.decision.verdict === 'APP_BUG') { res.result = 'KEPT'; res.why = g.target.failed?.label.rootCause ?? g.decision.why; }
        else if (g.decision.verdict === 'PASS') { res.result = 'MISSED'; res.why = 'the buggy build passes too: the test does not reach the bug'; }
        else { res.result = g.decision.verdict; res.why = g.decision.why; }
      }
    } catch (e: any) { res.result = 'ERROR'; res.why = String(e.message).split('\n')[0]; }
    writeFileSync(join(dir, 'result.json'), JSON.stringify(res, null, 2));
    log(`  MINED    ${res.result}${res.kaneLabel ? ` (Kane label ${res.kaneLabel} ${res.kaneConfidence ?? ''})` : ''}: ${res.why}`);
  }
  summarize(m.outDir, log);
}

export function summarize(outDir: string, log = console.log) {
  const rows: (CaseMeta & { result?: MineResult })[] = [];
  for (const d of readdirSync(outDir).filter(d => /^\d+$/.test(d) && existsSync(join(outDir, d, 'case.json')))) {
    const meta = JSON.parse(readFileSync(join(outDir, d, 'case.json'), 'utf8'));
    const r = existsSync(join(outDir, d, 'result.json')) ? JSON.parse(readFileSync(join(outDir, d, 'result.json'), 'utf8')) : undefined;
    rows.push({ ...meta, result: r });
  }
  const count = (f: (r: typeof rows[0]) => boolean) => rows.filter(f).length;
  const kept = rows.filter(r => r.result?.result === 'KEPT');
  const s = {
    candidates: rows.length, notTestable: count(r => r.status === 'not-testable'), noBuild: count(r => r.status === 'no-build'),
    written: count(r => r.status === 'written'), run: count(r => !!r.result), kept: kept.length,
    missed: count(r => r.result?.result === 'MISSED'), unrecordable: count(r => r.result?.result === 'UNRECORDABLE'),
    other: count(r => !!r.result && !['KEPT', 'MISSED', 'UNRECORDABLE'].includes(r.result.result)),
    kaneRightOnKept: kept.filter(r => r.result?.kaneLabel === 'application_issue').length,
  };
  writeFileSync(join(outDir, 'mined.json'), JSON.stringify({ summary: s, cases: rows }, null, 2));
  log(`\nmined    ${JSON.stringify(s)}`);
  return s;
}
