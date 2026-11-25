// witness pr: check an open pull request of a real app before it merges.
// The app publishes a live preview of every pull request (Netlify, Vercel, ...). WITNESS has Kane replay the app's
// saved tests on that preview; when one fails, the same recording runs on the app's live main build and decides.
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import type { WitnessConfig } from '../io/config.js';
import { guard, type GuardResult } from './guard.js';

export interface PrConfig {
  repo: string;                 // owner/name on GitHub
  preview: string;              // regex a preview URL matches; {n} stands for the pull request number
  live: { url: string; label: string };   // the app's live build of its main branch (the reference)
  setup?: string;               // prepares app state before each Kane run: gets {url}, {profile} and {base} (this file's folder)
  tests: string[];              // saved Kane tests (_test.md with output-<name>/ next to it)
  evidenceDir?: string;
  base: string;                 // folder of the config file
}

export interface OpenPr { number: number; title: string; author: string; headSha: string; preview: string | null; ai: boolean; }

export interface PrCheck {
  repo: string; number: number; title: string; author: string; ai: boolean; headSha: string;
  preview: string; live: string; started: string; seconds: number;
  results: { test: string; verdict: string; why: string; next: string; kaneLabel: string | null; kaneConfidence: number | null; target: string; reference: string | null; credits: number; card: string | null }[];
}

export function loadPrConfig(path: string): PrConfig {
  const base = dirname(resolve(path));
  const c = JSON.parse(readFileSync(path, 'utf8')) as PrConfig;
  const abs = (p: string) => (isAbsolute(p) ? p : resolve(base, p));
  c.tests = c.tests.map(abs);
  c.evidenceDir = abs(c.evidenceDir ?? '.witness/pr');
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
  const results: GuardResult[] = [];
  for (const t of cfg.tests) results.push(await guard(cfg, t, log));
  const check: PrCheck = {
    repo: c.repo, number: n, title: pr.title, author: pr.author, ai: pr.ai, headSha: pr.headSha, preview: pr.preview, live: c.live.url,
    started: started.toISOString(), seconds: Math.round((Date.now() - started.getTime()) / 1000),
    results: results.map(r => ({
      test: r.test.split('/').pop()!, verdict: r.decision.verdict, why: r.decision.why, next: r.decision.next,
      kaneLabel: r.decision.kaneLabel ?? null, kaneConfidence: r.decision.kaneConfidence ?? null,
      target: r.target.status, reference: r.reference?.status ?? null,
      credits: Math.round(((r.target.creditsReported ?? 0) + (r.reference?.creditsReported ?? 0)) * 100) / 100, card: r.card ?? null,
    })),
  };
  writeFileSync(join(dir, 'pr.json'), JSON.stringify(check, null, 2));
  log(`  RESULT     ${summaryLine(check)}`);
  return check;
}

export function summaryLine(c: PrCheck): string {
  const bad = c.results.filter(r => r.verdict === 'APP_BUG');
  if (bad.length) return `${bad.length} of ${c.results.length} tests found a bug this pull request adds: ${bad.map(b => b.test).join(', ')}`;
  const other = c.results.filter(r => r.verdict !== 'PASS');
  if (other.length) return `no bug added by this pull request; ${other.map(o => `${o.test} ${o.verdict}`).join(', ')}`;
  return `all ${c.results.length} tests pass on the preview`;
}
