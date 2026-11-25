// witness pr: check an open pull request of a real app before it merges.
// The app publishes a live preview of every pull request (Netlify, Vercel, ...). WITNESS has Kane replay the app's
// saved tests on that preview; when one fails, the same recording runs on the app's live main build and decides.
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import type { NpmSource, WitnessConfig } from '../io/config.js';
import { listVersions } from '../io/npm.js';
import { guard, type GuardResult } from './guard.js';
import { probe } from './search.js';

export interface PrConfig {
  repo: string;                 // owner/name on GitHub
  preview: string;              // regex a preview URL matches; {n} stands for the pull request number
  live: { url: string; label: string };   // the app's live build of its main branch (the reference)
  setup?: string;               // prepares app state before each Kane run: gets {url}, {profile} and {base} (this file's folder)
  tests: string[];              // saved Kane tests (_test.md with output-<name>/ next to it)
  evidenceDir?: string;
  areas?: Record<string, string[]>;   // test file (or a part of its name) -> regexes over changed file paths; a pull request gets the tests whose area it changes
  baseBuilds?: NpmSource & { match?: string };   // the app's published builds (e.g. nightlies): when a pull request's branch is behind main, the
                                                 // newest one published before the branch split off stands in for the branch's starting point
  cacheDir?: string;
  base: string;                 // folder of the config file
}

export interface OpenPr { number: number; title: string; author: string; headSha: string; preview: string | null; ai: boolean; }

export interface PrCheck {
  repo: string; number: number; title: string; author: string; ai: boolean; headSha: string;
  preview: string; live: string; started: string; seconds: number;
  base?: BranchBase;
  results: { test: string; verdict: string; baseBuild?: { version: string; status: string }; why: string; next: string; kaneLabel: string | null; kaneConfidence: number | null; target: string; reference: string | null; credits: number; card: string | null }[];
}

export function loadPrConfig(path: string): PrConfig {
  const base = dirname(resolve(path));
  const c = JSON.parse(readFileSync(path, 'utf8')) as PrConfig;
  const abs = (p: string) => (isAbsolute(p) ? p : resolve(base, p));
  c.tests = c.tests.map(abs);
  c.evidenceDir = abs(c.evidenceDir ?? '.witness/pr');
  c.cacheDir = abs(c.cacheDir ?? '.witness/builds');
  if (c.setup) c.setup = c.setup.replaceAll('{base}', base);   // "node {base}/setup.mjs {url} {profile}"
  c.base = base;
  return c;
}

/** The preview URL for pull request `n` among a commit's status and check links, or null. */
export function findPreview(links: string[], pattern: string, n: number): string | null {
  const re = new RegExp(pattern.replaceAll('{n}', String(n)));
  for (const l of links) { const m = l.match(re); if (m) return m[0].replace(/\/$/, ''); }
  return null;
}

/** True when the pull request says it was written by a coding agent (Actual marks these "[AI]"). */
export const isAiPr = (title: string) => /^\s*\[AI\]/i.test(title);

/** witness.json for one test of one pull request: target = the preview, reference = the live main build. */
export function prWitnessConfig(c: PrConfig, preview: string, evidenceDir: string): WitnessConfig {
  return {
    tests: c.tests,
    target: { url: preview, setup: c.setup, label: `pull request preview ${preview}` },
    reference: { url: c.live.url, setup: c.setup, label: c.live.label },
    evidenceDir,
  };
}

const gh = (args: string[]) => execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 << 20 });

function previewLinks(repo: string, sha: string): string[] {
  const statuses = JSON.parse(gh(['api', `repos/${repo}/commits/${sha}/statuses?per_page=100`])) as { target_url?: string; state: string }[];
  return statuses.filter(s => s.state === 'success' && s.target_url).map(s => s.target_url!);
}

export function listOpenPrs(c: PrConfig, max = 50): OpenPr[] {
  const prs = JSON.parse(gh(['pr', 'list', '-R', c.repo, '--state', 'open', '--limit', String(max), '--json', 'number,title,author,headRefOid,isDraft'])) as any[];
  return prs.map(p => ({ number: p.number, title: p.title, author: p.author?.login ?? '', headSha: p.headRefOid, ai: isAiPr(p.title), preview: findPreview(previewLinks(c.repo, p.headRefOid), c.preview, p.number) }));
}

const ghAsync = async (args: string[]) => (await promisify(execFile)('gh', args, { encoding: 'utf8', maxBuffer: 64 << 20 })).stdout;

/** Same as listOpenPrs, without blocking a server while GitHub answers. */
export async function listOpenPrsAsync(c: PrConfig, max = 50): Promise<OpenPr[]> {
  const prs = JSON.parse(await ghAsync(['pr', 'list', '-R', c.repo, '--state', 'open', '--limit', String(max), '--json', 'number,title,author,headRefOid'])) as any[];
  const out: OpenPr[] = [];
  for (const p of prs) {
    const statuses = JSON.parse(await ghAsync(['api', `repos/${c.repo}/commits/${p.headRefOid}/statuses?per_page=100`])) as { target_url?: string; state: string }[];
    const links = statuses.filter(s => s.state === 'success' && s.target_url).map(s => s.target_url!);
    out.push({ number: p.number, title: p.title, author: p.author?.login ?? '', headSha: p.headRefOid, ai: isAiPr(p.title), preview: findPreview(links, c.preview, p.number) });
  }
  return out;
}

export function getPr(c: PrConfig, n: number): OpenPr {
  const p = JSON.parse(gh(['pr', 'view', String(n), '-R', c.repo, '--json', 'number,title,author,headRefOid,state']));
  return { number: p.number, title: p.title, author: p.author?.login ?? '', headSha: p.headRefOid, ai: isAiPr(p.title), preview: findPreview(previewLinks(c.repo, p.headRefOid), c.preview, p.number) };
}

/** Runs every test on the pull request's preview; a failing test is replayed on the live main build to decide. */
export async function checkPr(c: PrConfig, n: number, log = console.log, only?: string): Promise<PrCheck> {
  const pr = getPr(c, n);
  if (!pr.preview) throw new Error(`pull request #${n} of ${c.repo} has no finished preview yet`);
  const started = new Date();
  const dir = join(c.evidenceDir!, `pr-${n}-${started.toISOString().replace(/[:.]/g, '-')}`);
  mkdirSync(dir, { recursive: true });
  const cfg = prWitnessConfig(c, pr.preview, dir);
  if (only) { const want = only.split(',').map(x => x.trim()).filter(Boolean); cfg.tests = cfg.tests.filter(t => want.some(w => t.includes(w))); }
  log(`witness pr  ${c.repo}#${n}  ${pr.ai ? '[written by a coding agent] ' : ''}${pr.title}`);
  log(`  preview    ${pr.preview}   (head ${pr.headSha.slice(0, 12)})`);
  log(`  live main  ${c.live.url}`);
  const base = branchBase(c.repo, pr.headSha);
  if (base?.behindBy) log(`  branch     ${base.behindBy} commits behind main (split off ${base.date.slice(0, 10)}, ${base.sha.slice(0, 12)})`);
  const results: GuardResult[] = [];
  const baseRuns: Record<string, { version: string; status: string }> = {};
  for (const t of cfg.tests) {
    const r = await guard(cfg, t, log);
    results.push(r);
    // A test that fails on the preview and passes on main is only the pull request's bug if the branch has everything
    // main had when it split off. When the branch is behind, main may have fixed the bug since: replay on the build
    // from before the split. Failing there too means the bug is older than the pull request.
    if (r.decision.verdict === 'APP_BUG' && base?.behindBy) {
      const b = await baseBuildRun(c, base, t, log);
      if (b) { baseRuns[t] = b; r.decision = splitDecision(r.decision, base, b); log(`  VERDICT    ${r.decision.verdict}: ${r.decision.why}`); }
    }
  }
  const check: PrCheck = {
    repo: c.repo, number: n, title: pr.title, author: pr.author, ai: pr.ai, headSha: pr.headSha, preview: pr.preview, live: c.live.url,
    started: started.toISOString(), seconds: Math.round((Date.now() - started.getTime()) / 1000), base: base ?? undefined,
    results: results.map(r => ({
      test: r.test.split('/').pop()!, verdict: r.decision.verdict, baseBuild: baseRuns[r.test], why: r.decision.why, next: r.decision.next,
      kaneLabel: r.decision.kaneLabel ?? null, kaneConfidence: r.decision.kaneConfidence ?? null,
      target: r.target.status, reference: r.reference?.status ?? null,
      credits: Math.round(((r.target.creditsReported ?? 0) + (r.reference?.creditsReported ?? 0)) * 100) / 100, card: r.card ?? null,
    })),
  };
  writeFileSync(join(dir, 'pr.json'), JSON.stringify(check, null, 2));
  log(`  RESULT     ${summaryLine(check)}`);
  return check;
}

export interface BranchBase { sha: string; date: string; behindBy: number; }

/** Where a pull request's branch split off main, and how many commits main has gained since. */
export function branchBase(repo: string, head: string): BranchBase | null {
  try {
    const main = JSON.parse(gh(['api', `repos/${repo}`])).default_branch as string;
    const cmp = JSON.parse(gh(['api', `repos/${repo}/compare/${main}...${head}`]));
    return { sha: cmp.merge_base_commit.sha, date: cmp.merge_base_commit.commit.committer.date, behindBy: cmp.behind_by };
  } catch { return null; }
}

/** The newest published build from before `date` (so every change in it is also in the branch). */
export function buildBefore(versions: { version: string; time: string }[], date: string, match?: string) {
  const re = match ? new RegExp(match) : null;
  return versions.filter(v => v.time && v.time < date && (!re || re.test(v.version))).pop() ?? null;
}

async function baseBuildRun(c: PrConfig, base: BranchBase, test: string, log: (s: string) => void) {
  if (!c.baseBuilds) return null;
  const v = buildBefore(await listVersions(c.baseBuilds.npm), base.date, c.baseBuilds.match);
  if (!v) return null;
  log(`  start      replaying on ${c.baseBuilds.npm}@${v.version}, the newest build from before the branch split off`);
  const p = await probe({ ...c.baseBuilds, setup: c.baseBuilds.setup ?? c.setup }, v.version, test, c.cacheDir!, log);
  return { version: v.version, status: p.status };
}

/** The verdict once the branch's starting point has been replayed. */
export function splitDecision<D extends { verdict: string; why: string; next: string }>(d: D, base: BranchBase, b: { version: string; status: string }): D {
  if (b.status === 'failed') return { ...d, verdict: 'BEHIND_MAIN',
    why: `This branch is ${base.behindBy} commits behind main, and the build from before it split off (${b.version}) fails the same test, so this pull request did not add the bug: main has fixed it since.`,
    next: 'Update the branch from main and check again.' };
  if (b.status === 'passed') return { ...d, why: `${d.why} The build from before the branch split off (${b.version}) passes, so the change came in on this branch.` };
  return d;
}

export function summaryLine(c: PrCheck): string {
  const bad = c.results.filter(r => r.verdict === 'APP_BUG');
  if (bad.length) return `${bad.length} of ${c.results.length} tests found a bug this pull request adds: ${bad.map(b => b.test).join(', ')}`;
  const other = c.results.filter(r => r.verdict !== 'PASS');
  if (other.length) return `no bug added by this pull request; ${other.map(o => `${o.test} ${o.verdict}`).join(', ')}`;
  return `all ${c.results.length} tests pass on the preview`;
}

/** The tests whose area a pull request changes (all tests when the config names no areas). */
export function testsFor(c: PrConfig, files: string[]): string[] {
  if (!c.areas) return c.tests;
  const code = files.filter(f => !/\.test\.|\/e2e\/|\.md$/.test(f));
  return c.tests.filter(t => Object.entries(c.areas!).some(([name, rxs]) => t.includes(name) && rxs.some(rx => code.some(f => new RegExp(rx).test(f)))));
}

/** Every finished check in the evidence folder, newest first. */
export function pastChecks(c: PrConfig): PrCheck[] {
  const dir = c.evidenceDir!;
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(d => d.startsWith('pr-')).map(d => join(dir, d, 'pr.json')).filter(existsSync)
    .map(f => JSON.parse(readFileSync(f, 'utf8')) as PrCheck).sort((a, b) => b.started.localeCompare(a.started));
}

/** witness pr watch: checks each open pull request with a finished preview whose newest commit has not been checked,
 *  with the tests for the areas it changes. Pull requests that change none of them are listed and skipped. */
export async function watchPrs(c: PrConfig, log = console.log, max = 10, opts: { plan?: (n: number, tests: string) => void } = {}): Promise<{ checked: PrCheck[]; skipped: number[]; noPreview: number[]; planned: number }> {
  const done = new Set(pastChecks(c).map(p => `${p.number}@${p.headSha}`));
  const open = JSON.parse(gh(['pr', 'list', '-R', c.repo, '--state', 'open', '--limit', '100', '--json', 'number,title,headRefOid,files'])) as any[];
  const checked: PrCheck[] = [], skipped: number[] = [], noPreview: number[] = [];
  let planned = 0;
  for (const p of open) {
    if (checked.length + planned >= max) break;
    if (done.has(`${p.number}@${p.headRefOid}`)) continue;
    const tests = testsFor(c, (p.files ?? []).map((f: any) => f.path));
    if (!tests.length) { skipped.push(p.number); continue; }
    const links = previewLinks(c.repo, p.headRefOid);
    if (!findPreview(links, c.preview, p.number)) { noPreview.push(p.number); continue; }
    const only = tests.map(t => t.split('/').pop()!).join(',');
    if (opts.plan) { opts.plan(p.number, only); planned++; continue; }
    try { checked.push(await checkPr(c, p.number, log, only)); }
    catch (e) { log(`  #${p.number}: ${(e as Error).message}`); }
  }
  if (opts.plan) return { checked, skipped, noPreview, planned };
  log(`watch      ${checked.length} checked, ${skipped.length} change no tested area, ${noPreview.length} without a finished preview`);
  return { checked, skipped, noPreview, planned };
}
