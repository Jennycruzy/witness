// witness record: record (or re-record) a test's steps with Kane on the reference build, then keep the recording.
// For an npm build channel the reference is the newest release, so nightly checks replay a known-good recording.
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fetchBuild, isRelease, listVersions } from '../io/npm.js';
import { runKane } from '../io/kane.js';
import { open } from './guard.js';
import type { BuildRef, WitnessConfig } from '../io/config.js';

export async function record(cfg: WitnessConfig, testFile: string, log = console.log) {
  let ref: BuildRef = cfg.reference;
  let label = cfg.reference.url ?? cfg.reference.dir ?? '';
  const src = cfg.nightly;
  if (src) {
    const all = await listVersions(src.npm);
    const release = [...all].reverse().find(v => isRelease(v.version))!;
    ref = { dir: join(await fetchBuild(src.npm, release.version, cfg.cacheDir!), src.buildDir ?? ''), isolation: src.isolation, setup: src.setup };
    label = `${src.npm}@${release.version}`;
  }
  const b = await open(ref);
  const name = basename(testFile).replace(/_test\.md$/, '');
  try {
    log(`record   ${basename(testFile)}  on ${label}`);
    const r = await runKane({ testFile, url: b.url, profileTemplate: b.profile, rerecord: true, keepWorkDir: true, timeoutSec: 1200 });
    try {
      const evDir = cfg.evidenceDir ?? '.witness/runs';
      mkdirSync(evDir, { recursive: true });
      const evFile = join(evDir, `${new Date().toISOString().replace(/[:.]/g, '-')}-record-${name}.ndjson`);
      writeFileSync(evFile, r.ndjson);
      log(`  log      ${evFile}`);
      log(`  result   ${r.summary.status.toUpperCase()}${r.summary.failed ? ` at test step ${Number(r.summary.failed.runId.replace('run-', '')) + 1}` : ''}`);
      if (r.summary.status !== 'passed') return { ok: false, summary: r.summary };
      const from = join(r.workDir, `output-${name}`), to = join(dirname(testFile), `output-${name}`);
      if (!existsSync(from)) throw new Error(`Kane wrote no recording folder output-${name}`);
      rmSync(to, { recursive: true, force: true });
      cpSync(from, to, { recursive: true });
      log(`  saved    ${to}`);
      return { ok: true, summary: r.summary };
    } finally { rmSync(r.workDir, { recursive: true, force: true }); }
  } finally { await b.close(); }
}
