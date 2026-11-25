// witness bench: the triage bench. A fixed list of real cases, each with its right answer written down before any
// run (cases.json is hashed into registration.json and committed first). Every case is replayed fresh with the Kane
// version on PATH; Kane's own label and WITNESS's verdict are each scored against the answer.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { loadConfig } from '../io/config.js';
import { guard } from './guard.js';

export type Truth = 'APP_BUG' | 'TEST_PROBLEM' | 'ENV' | 'PASS';
export interface BenchCase { id: string; truth: Truth; config: string; test: string; swap?: boolean; note?: string; }
export interface BenchFile { about: string; cases: BenchCase[]; }
export interface BenchRow { id: string; truth: Truth; half: 'A' | 'B'; verdict: string; kaneLabel: string | null; kaneConfidence: number | null; target: string; credits: number; }

/** Fixed split: the held-out half is decided by the case id alone, so nobody can pick it after seeing results. */
export const half = (id: string): 'A' | 'B' => (createHash('sha256').update(id).digest()[0] % 2 === 0 ? 'A' : 'B');

/** Is Kane's own label the right answer? A real app bug should be application_issue; a test problem automation_bug;
 *  a build that works should simply pass (no label). An ENV case has no right label, so it is not scored for Kane. */
export function kaneRight(truth: Truth, row: { kaneLabel: string | null; target: string }): boolean | null {
  if (truth === 'ENV') return null;
  if (truth === 'PASS') return row.target === 'passed';
  if (row.target === 'passed') return false;                 // Kane passed a real bug, or passed a broken test
  return truth === 'APP_BUG' ? row.kaneLabel === 'application_issue' : row.kaneLabel === 'automation_bug';
}
export const witnessRight = (truth: Truth, verdict: string) => verdict === truth;

export function sha256File(p: string) { return createHash('sha256').update(readFileSync(p)).digest('hex'); }

export function register(casesPath: string) {
  const f = JSON.parse(readFileSync(casesPath, 'utf8')) as BenchFile;
  const reg = { cases: casesPath.split('/').pop(), sha256: sha256File(casesPath), count: f.cases.length,
    byTruth: count(f.cases.map(c => c.truth)), heldOut: f.cases.filter(c => half(c.id) === 'B').map(c => c.id), registeredAt: new Date().toISOString() };
  writeFileSync(join(dirname(casesPath), 'registration.json'), JSON.stringify(reg, null, 2) + '\n');
  return reg;
}

const count = (xs: string[]) => xs.reduce((m: Record<string, number>, x) => ({ ...m, [x]: (m[x] ?? 0) + 1 }), {});

export async function runBench(casesPath: string, label: string, log = console.log, only?: string[]) {
  const base = dirname(resolve(casesPath));
  const reg = JSON.parse(readFileSync(join(base, 'registration.json'), 'utf8'));
  if (reg.sha256 !== sha256File(casesPath)) throw new Error('cases.json changed after it was registered: register again, commit, then run');
  const f = JSON.parse(readFileSync(casesPath, 'utf8')) as BenchFile;
  const kane = execFileSync('kane-cli', ['--version'], { encoding: 'utf8' }).trim().split('\n').pop()!;
  const outDir = join(base, 'runs', label);
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, 'results.json');
  const prev: BenchRow[] = existsSync(outFile) ? JSON.parse(readFileSync(outFile, 'utf8')).rows : [];
  const rows = [...prev];
  for (const c of f.cases) {
    if (only && !only.includes(c.id)) continue;
    if (rows.some(r => r.id === c.id)) continue;                  // resumable: a finished case is kept
    const cfg = loadConfig(resolve(base, c.config));
    if (c.swap) [cfg.target, cfg.reference] = [cfg.reference, cfg.target];
    cfg.tests = cfg.tests.filter(t => t.endsWith(c.test));
    if (!cfg.tests.length) throw new Error(`${c.id}: no test ${c.test} in ${c.config}`);
    cfg.evidenceDir = join(outDir, c.id);
    log(`bench      ${c.id}  (answer ${c.truth})`);
    const cwd = process.cwd();
    process.chdir(setupHome(dirname(resolve(base, c.config)), cfg.target.setup ?? cfg.reference?.setup));   // setup commands are relative to their example's folder
    let r;
    try { r = await guard(cfg, cfg.tests[0], log); } finally { process.chdir(cwd); }
    rows.push({ id: c.id, truth: c.truth, half: half(c.id), verdict: r.decision.verdict, kaneLabel: r.decision.kaneLabel ?? null,
      kaneConfidence: r.decision.kaneConfidence ?? null, target: r.target.status, credits: (r.target.creditsReported ?? 0) + (r.reference?.creditsReported ?? 0) });
    writeFileSync(outFile, JSON.stringify({ kane, label, casesSha256: reg.sha256, rows }, null, 2) + '\n');
  }
  return score(rows);
}

/** The folder a case's setup command runs from: its config's folder, or the nearest folder above it that holds the
 *  script the command names (mined cases keep one setup.mjs for the whole app, next to mine.json). */
export function setupHome(dir: string, setup?: string): string {
  const script = setup?.match(/(?:^|\s)([^\s{}]+\.(?:m?js|sh))(?=\s|$)/)?.[1];
  if (!script || isAbsolute(script)) return dir;
  for (let d = dir; ; d = dirname(d)) { if (existsSync(join(d, script))) return d; if (dirname(d) === d) return dir; }
}

export function score(rows: BenchRow[]) {
  const line = (rs: BenchRow[]) => {
    const k = rs.map(r => kaneRight(r.truth, r)).filter(x => x !== null) as boolean[];
    return { cases: rs.length, kaneRight: k.filter(Boolean).length, kaneScored: k.length, witnessRight: rs.filter(r => witnessRight(r.truth, r.verdict)).length };
  };
  const by = (pred: (r: BenchRow) => boolean) => line(rows.filter(pred));
  return {
    all: line(rows), heldOut: by(r => r.half === 'B'), dev: by(r => r.half === 'A'),
    APP_BUG: by(r => r.truth === 'APP_BUG'), TEST_PROBLEM: by(r => r.truth === 'TEST_PROBLEM'), ENV: by(r => r.truth === 'ENV'), PASS: by(r => r.truth === 'PASS'),
    credits: Math.round(rows.reduce((n, r) => n + r.credits, 0) * 100) / 100,
  };
}

/** Prints one line per finished run folder (runs/<label>/results.json). */
export function scoreAll(casesPath: string, log = console.log) {
  const dir = join(dirname(resolve(casesPath)), 'runs');
  if (!existsSync(dir)) { log('no runs yet'); return; }
  for (const label of readdirSync(dir).sort()) {
    const f = join(dir, label, 'results.json');
    if (!existsSync(f)) continue;
    const r = JSON.parse(readFileSync(f, 'utf8'));
    const s = score(r.rows);
    const pct = (a: number, b: number) => `${a} of ${b}`;
    log(`${label.padEnd(16)} kane ${r.kane.padEnd(8)} cases ${s.all.cases}  Kane right ${pct(s.all.kaneRight, s.all.kaneScored)}  WITNESS right ${pct(s.all.witnessRight, s.all.cases)}  | held-out: Kane ${pct(s.heldOut.kaneRight, s.heldOut.kaneScored)}, WITNESS ${pct(s.heldOut.witnessRight, s.heldOut.cases)}  | app bugs: Kane ${pct(s.APP_BUG.kaneRight, s.APP_BUG.kaneScored)}, WITNESS ${pct(s.APP_BUG.witnessRight, s.APP_BUG.cases)}  | controls: Kane ${pct(s.PASS.kaneRight, s.PASS.kaneScored)}, WITNESS ${pct(s.PASS.witnessRight, s.PASS.cases)}`);
  }
}
