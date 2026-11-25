// witness guard --carry-state: bugs that only show with data a browser saved on an earlier build.
// Kane starts every run from a clean browser, so an upgrade bug that needs saved data passes on both builds.
// Here the user's history (witness.json "carryState") runs first, every build on one fixed port (browser storage
// belongs to an origin), and the saved profile is carried into the target run. The same recording also runs on the
// target in a clean browser and on the reference with the saved data. Fails only with the saved data: STATE_BUG.
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, relative } from 'node:path';
import { classifyCarried, labelDisagrees } from '../core/classify.js';
import { buildCard, parseTestSteps } from '../core/card.js';
import { findBlindChecks } from '../core/blind.js';
import { findLockedChecks } from '../core/locked.js';
import type { RunSummary } from '../core/stream.js';
import { runKane, type KaneRun } from '../io/kane.js';
import { prepareProfile, runCommand } from '../io/setup.js';
import type { WitnessConfig } from '../io/config.js';
import { open, type GuardResult } from './guard.js';

/** profile/data: after the whole history. refProfile/refData: copies taken after the last reference step, because a
 *  newer build may change saved data so the older build cannot load it again (a server migrates its database). */
export interface Carried { profile: string; data: string; refProfile: string; refData: string; dir: string; log: string; remove: () => void; }

/** Plays the user's history on the builds it names, on the fixed port, and returns the saved profile. */
export async function prepareCarried(cfg: WitnessConfig, log = console.log): Promise<Carried> {
  const cs = cfg.carryState!;
  const dir = mkdtempSync(join(tmpdir(), 'witness-carry-'));
  const data = join(dir, 'data'), profile = join(dir, 'profile');
  mkdirSync(data);
  let out = '';
  const refProfile = join(dir, 'reference-profile'), refData = join(dir, 'reference-data');
  const lastRef = cs.history.map(h => h.build).lastIndexOf('reference');
  try {
    if (lastRef < 0) { mkdirSync(refProfile); cpSync(data, refData, { recursive: true }); }
    for (const [i, h] of cs.history.entries()) {
      const b = await open(h.build === 'target' ? cfg.target : cfg.reference, cfg.cacheDir, { port: cs.port, data }, { setup: false });
      try {
        log(`  history    ${i + 1}/${cs.history.length} on the ${h.build} build`);
        out += `### ${i + 1}. ${h.build}: ${h.run}\n` + await runCommand(h.run, { url: b.url, profile, dir }) + '\n';
      } finally { await b.close(); }
      if (i === lastRef) { cpSync(profile, refProfile, { recursive: true }); cpSync(data, refData, { recursive: true }); }
    }
  } catch (e) { rmSync(dir, { recursive: true, force: true }); throw e; }
  return { profile, data, refProfile, refData, dir, log: out, remove: () => rmSync(dir, { recursive: true, force: true }) };
}

const step = (s: RunSummary) => (s.failed ? ` at test step ${Number(s.failed.runId.replace('run-', '')) + 1} (${s.failed.kind})` : '');

export async function guardCarried(cfg: WitnessConfig, testFile: string, log = console.log): Promise<GuardResult> {
  const cs = cfg.carryState!;
  const evidenceDir = join(cfg.evidenceDir ?? '.witness/runs', `${new Date().toISOString().replace(/[:.]/g, '-')}-${basename(testFile, '.md')}-carried`);
  mkdirSync(evidenceDir, { recursive: true });
  const locked = findLockedChecks(testFile);
  log(`witness  ${basename(testFile)}  with saved data, port ${cs.port}`);
  const c = await prepareCarried(cfg, log);
  writeFileSync(join(evidenceDir, 'history.txt'), c.log);
  let target: RunSummary, clean: RunSummary | undefined, reference: RunSummary | undefined;
  try {
    // Every target attempt (first try, its retry, the clean-browser run) starts on its own copy of the server data the
    // history left, so an attempt that writes to the server cannot change what the next attempt sees.
    let n = 0;
    const attempt = async (savedProfile: boolean): Promise<KaneRun> => {
      const data = join(c.dir, `target-data-${++n}`); cpSync(c.data, data, { recursive: true });
      const t = await open(cfg.target, cfg.cacheDir, { port: cs.port, data }, { setup: false });
      let p: { dir: string; remove: () => void } | null = null;
      try {
        let prof: string | undefined;
        if (savedProfile) {
          prof = c.profile;
          if (cs.upgrade) {
            prof = join(c.dir, `upgraded-${n}`); cpSync(c.profile, prof, { recursive: true });
            writeFileSync(join(evidenceDir, 'upgrade.txt'), await runCommand(cs.upgrade, { url: t.url, profile: prof, dir: c.dir }));
          }
        } else {
          p = cfg.target.setup ? await prepareProfile(cfg.target.setup, t.url) : null;
          prof = p?.dir;
        }
        return await runKane({ testFile, url: t.url, profileTemplate: prof });
      } finally { p?.remove(); await t.close(); }
    };
    // A click or typing failure is replayed once more, as in plain guard, on fresh data.
    const tryTwice = async (savedProfile: boolean) => {
      let r = await attempt(savedProfile);
      if (r.summary.status === 'failed' && r.summary.failed?.kind === 'action' && (r.summary.authorDecisions ?? 0) === 0) r = await attempt(savedProfile);
      return r;
    };
    // 1. Target, in the profile the earlier builds saved (after the upgrade step, when there is one).
    const r = await tryTwice(true);
    writeFileSync(join(evidenceDir, 'target.ndjson'), r.ndjson);
    target = r.summary;
    log(`  target     ${target.status.toUpperCase()}${step(target)}  (saved data)`);
    if (target.status !== 'passed') {
      // 2. Target, clean browser: what a plain Kane run sees.
      const r2 = await tryTwice(false);
      writeFileSync(join(evidenceDir, 'target-clean.ndjson'), r2.ndjson);
      clean = r2.summary;
      log(`  target     ${clean.status.toUpperCase()}${step(clean)}  (clean browser)`);
    }
    // 3. Reference, with the data it saved itself (taken after its last history step).
    if (target.status !== 'passed') {
      const b = await open(cfg.reference, cfg.cacheDir, { port: cs.port, data: c.refData }, { setup: false });
      try {
        const r = await runKane({ testFile, url: b.url, profileTemplate: c.refProfile });
        writeFileSync(join(evidenceDir, 'reference.ndjson'), r.ndjson);
        reference = r.summary;
        log(`  reference  ${reference.status.toUpperCase()}${step(reference)}  (saved data)`);
      } finally { await b.close(); }
    }
  } finally { c.remove(); }
  const blind = findBlindChecks(readFileSync(join(evidenceDir, 'target.ndjson'), 'utf8'));
  const decision = classifyCarried(target, clean ?? target, reference ?? target);
  if (decision.kaneLabel) log(`  Kane label ${decision.kaneLabel} ${decision.kaneConfidence ?? ''}${labelDisagrees(decision) ? '   <- disagrees with the comparison' : ''}`);
  log(`  VERDICT    ${decision.verdict}: ${decision.why}`);
  log(`  next       ${decision.next}`);
  let card: string | undefined;
  if (decision.verdict !== 'PASS') {
    card = buildCard({ testName: basename(testFile), steps: parseTestSteps(readFileSync(testFile, 'utf8')), target, decision, targetUrl: cfg.target.label ?? cfg.target.serve ?? relative(process.cwd(), cfg.target.dir ?? ''), referenceUrl: cfg.reference.label ?? cfg.reference.serve ?? relative(process.cwd(), cfg.reference.dir ?? ''), spec: cfg.spec });
    writeFileSync(join(evidenceDir, 'card.md'), card);
  }
  writeFileSync(join(evidenceDir, 'decision.json'), JSON.stringify({ test: testFile, carryState: true, decision, target, targetClean: clean ?? null, reference: reference ?? null, blind, locked }, null, 2));
  log(`  evidence   ${evidenceDir}`);
  return { test: testFile, decision, target, reference, card, evidenceDir, blind, locked };
}
