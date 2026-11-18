// witness watch: check the newest nightly against the newest release; on an app bug, find the first bad nightly.
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fetchBuild, isNightly, isRelease, listVersions } from '../io/npm.js';
import { guard } from './guard.js';
import { search } from './search.js';
import type { WitnessConfig } from '../io/config.js';

export async function watch(cfg: WitnessConfig, log = console.log) {
  const src = cfg.nightly; if (!src) throw new Error('witness.json has no "nightly" section');
  const cache = cfg.cacheDir!; mkdirSync(cache, { recursive: true });
  const all = await listVersions(src.npm);
  const release = [...all].reverse().find(v => isRelease(v.version))!;
  const nightlies = all.filter(v => isNightly(v.version));
  const latest = nightlies[nightlies.length - 1];
  log(`watch ${src.npm}: nightly ${latest.version} against release ${release.version}`);
  const tDir = join(await fetchBuild(src.npm, latest.version, cache), src.buildDir ?? '');
  const rDir = join(await fetchBuild(src.npm, release.version, cache), src.buildDir ?? '');
  const report: any = { date: new Date().toISOString(), nightly: latest.version, release: release.version, results: [] };
  for (const t of cfg.tests) {
    const r = await guard({ ...cfg, target: { dir: tDir, isolation: src.isolation, setup: src.setup }, reference: { dir: rDir, isolation: src.isolation, setup: src.setup } }, t, log);
    const entry: any = { test: t, verdict: r.decision.verdict, kaneLabel: r.decision.kaneLabel, blind: r.blind, locked: r.locked, evidence: r.evidenceDir };
    if (r.decision.verdict === 'APP_BUG') {
      const since = nightlies.filter(v => v.time >= release.time);
      log(`  searching ${since.length} nightlies since ${release.version} for the first bad build`);
      entry.search = await search(src, [release, ...since], t, cache, log);
      log(`  first bad ${entry.search.firstBad}  (last good ${entry.search.lastGood}); ${entry.search.commits.length} commits in between`);
    }
    report.results.push(entry);
  }
  const out = join(cfg.evidenceDir!, '..', 'nightly');
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, `${latest.version}.json`), JSON.stringify(report, null, 2));
  appendFileSync(join(out, 'history.jsonl'), JSON.stringify({ date: report.date, nightly: latest.version, verdicts: report.results.map((x: any) => x.verdict) }) + '\n');
  return report;
}
