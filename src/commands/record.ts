// witness record: record (or re-record) a test's steps with Kane on the reference build, then keep the recording.
// For an npm build channel the reference is the newest release, so nightly checks replay a known-good recording.
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fetchBuild, isRelease, listVersions } from '../io/npm.js';
import { runKane } from '../io/kane.js';
import { findLooseChecks } from '../core/locked.js';
import { open } from './guard.js';
import { prepareCarried, type Carried } from './carry.js';
import type { BuildRef, WitnessConfig } from '../io/config.js';

export async function record(cfg: WitnessConfig, testFile: string, log = console.log, opts: { carryState?: boolean } = {}) {
  let ref: BuildRef = cfg.reference;
  let label = cfg.reference.label ?? cfg.reference.url ?? cfg.reference.dir ?? cfg.reference.npm ?? cfg.reference.git ?? cfg.reference.kane?.app ?? '';
  const src = cfg.nightly;
  if (src) {
    const all = await listVersions(src.npm);
    const release = [...all].reverse().find(v => isRelease(v.version))!;
    ref = { dir: join(await fetchBuild(src.npm, release.version, cfg.cacheDir!), src.buildDir ?? ''), isolation: src.isolation, setup: src.setup };
    label = `${src.npm}@${release.version}`;
  }
  // Saved-state tests are recorded on the reference in the profile the user's history leaves behind.
  let carried: Carried | undefined;
  if (opts.carryState) { carried = await prepareCarried(cfg, log); label += ' (saved data)'; }
  const b0 = await open(ref, cfg.cacheDir, carried ? { port: cfg.carryState!.port, data: carried.refData } : undefined, { setup: !carried });
  const b = carried ? { ...b0, profile: carried.refProfile, close: async () => { await b0.close(); carried!.remove(); } } : b0;
  const name = basename(testFile).replace(/_test\.md$/, '');
  try {
    log(`record   ${basename(testFile)}  on ${label}`);
    const r = await runKane({ testFile, url: b.url, mobile: b.mobile, profileTemplate: b.profile, rerecord: true, keepWorkDir: true, timeoutSec: 1200 });
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
      for (const l of findLooseChecks(testFile)) log(`  LOOSE    test step ${l.step}: "${l.query}" was recorded with expected ${JSON.stringify(l.expected)} but no code to read the page, so a replay cannot check it. Reword that step to name exactly what to read.`);
      // A recording counts only when it replays on the build it was made on (free when it passes).
      const check = await runKane({ testFile, url: b.url, mobile: b.mobile, profileTemplate: b.profile });
      if (check.summary.status !== 'passed' || (check.summary.authorDecisions ?? 0) > 0) {
        const f = check.summary.failed;
        log(`  UNSTABLE the new recording does not replay on ${label}${f ? ` (test step ${Number(f.runId.replace('run-', '')) + 1}: ${f.label.rootCause ?? f.reason})` : ''}. Reword that step and record again.`);
        return { ok: false, unstable: true, summary: check.summary };
      }
      log(`  checked  the recording replays on ${label}`);
      return { ok: true, summary: r.summary };
    } finally { rmSync(r.workDir, { recursive: true, force: true }); }
  } finally { await b.close(); }
}
