// witness search: binary search over published builds with Kane replays to find the first bad build,
// then list the commits that landed between the last good and the first bad build.
import { join } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fetchBuild } from '../io/npm.js';
import { runKane } from '../io/kane.js';
import { serveDir } from '../io/serve.js';
import { prepareProfile } from '../io/setup.js';
import type { NpmSource } from '../io/config.js';

export interface Probe { version: string; status: 'passed' | 'failed' | 'unknown'; failedKind?: string; }
export interface SearchResult { lastGood: string; firstBad: string; probes: Probe[]; commits: { sha: string; date: string; title: string }[]; }

export async function probe(src: NpmSource, version: string, testFile: string, cacheDir: string, log = console.log): Promise<Probe> {
  const pkgDir = await fetchBuild(src.npm, version, cacheDir);
  const served = await serveDir(join(pkgDir, src.buildDir ?? ''), { isolation: src.isolation });
  try {
    const profile = src.setup ? await prepareProfile(src.setup, served.url) : undefined;
    const run = await runKane({ testFile, url: served.url, profileTemplate: profile?.dir });
    profile?.remove();
    const p: Probe = { version, status: run.summary.status, failedKind: run.summary.failed?.kind };
    log(`  ${version.padEnd(28)} ${p.status.toUpperCase()}${p.failedKind ? ` (${p.failedKind})` : ''}`);
    return p;
  } finally { await served.close(); }
}

async function commitsBetween(repo: string, since: string, until: string) {
  const r = await fetch(`https://api.github.com/repos/${repo}/commits?since=${since}&until=${until}&per_page=100`, { headers: { accept: 'application/vnd.github+json' } });
  if (!r.ok) return [];
  const j: any[] = await r.json();
  return j.map(c => ({ sha: c.sha.slice(0, 9), date: c.commit.committer.date, title: String(c.commit.message).split('\n')[0] }));
}

/** versions: ordered oldest -> newest; versions[0] is known good, last is known bad. */
export async function search(src: NpmSource, versions: { version: string; time: string }[], testFile: string, cacheDir: string, log = console.log): Promise<SearchResult> {
  mkdirSync(cacheDir, { recursive: true });
  const probes: Probe[] = [];
  let lo = 0, hi = versions.length - 1;               // lo = good, hi = bad (an app bug, failed at a check)
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    let p = await probe(src, versions[mid].version, testFile, cacheDir, log);
    if (p.status === 'failed' && p.failedKind !== 'check') { log(`  ${versions[mid].version} failed at an action; replaying once more`); p = await probe(src, versions[mid].version, testFile, cacheDir, log); }
    probes.push(p);
    if (p.status === 'unknown') throw new Error(`NOT_RUN: Kane gave no result on ${versions[mid].version} (check Chrome, the Kane login and the network); the search stops here instead of guessing`);
    if (p.status === 'passed') lo = mid; else if (p.failedKind === 'check') hi = mid;
    else { log(`  ${versions[mid].version} failed at an action: the page changed there; skipping it`); versions.splice(mid, 1); hi--; }
  }
  const good = versions[lo], bad = versions[hi];
  const commits = src.repo ? await commitsBetween(src.repo, nightlyCut(good.time), nightlyCut(bad.time)) : [];
  const result = { lastGood: good.version, firstBad: bad.version, probes, commits };
  writeFileSync(join(cacheDir, `search-${bad.version}.json`), JSON.stringify(result, null, 2));
  return result;
}

const nightlyCut = (iso: string) => new Date(iso).toISOString();
