// witness fix: give the card to the coding agent, keep its changes inside the app source, rebuild,
// and prove the fix with the UNCHANGED recording. Up to N rounds.
import { execSync, spawnSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';
import { guard, type GuardResult } from './guard.js';
import { recordingHash } from '../io/kane.js';
import type { WitnessConfig } from '../io/config.js';

export type FixOutcome = 'PROVEN' | 'FAILED' | 'REJECTED' | 'NOT_AN_APP_BUG';

export interface FixResult { outcome: FixOutcome; rounds: number; changedFiles: string[]; recordingSha256: string; last: GuardResult; }

/** [path, status+content hash] for every modified or untracked file, so changes made by the agent can be told apart. */
function changedEntries(cwd: string): [string, string][] {
  const out = execSync('git status --porcelain --untracked-files=all', { cwd, encoding: 'utf8' });
  return out.split('\n').filter(Boolean).map(l => {
    const p = l.slice(3).trim();
    let h = '';
    try { h = createHash('sha256').update(readFileSync(join(cwd, p))).digest('hex'); } catch { h = 'gone'; }
    return [p, `${l.slice(0, 2)}:${h}`] as [string, string];
  });
}
function changedFiles(cwd: string): string[] { return changedEntries(cwd).map(([p]) => p).filter(p => !p.startsWith('dist/')); }

export async function fix(cfg: WitnessConfig, testFile: string, log = console.log, opts: { carryState?: boolean } = {}): Promise<FixResult> {
  if (!cfg.fix) throw new Error('witness.json has no "fix" section');
  const f = cfg.fix;
  const before = recordingHash(testFile);
  let last = await guard(cfg, testFile, log, { carryState: opts.carryState });
  if (last.decision.verdict !== 'APP_BUG' && last.decision.verdict !== 'STATE_BUG') return { outcome: 'NOT_AN_APP_BUG', rounds: 0, changedFiles: [], recordingSha256: before, last };
  const rounds = f.rounds ?? 3;
  const src = f.source.replace(/\/?$/, '/');
  const ignore = f.ignore ?? ['dist/'];
  for (let i = 1; i <= rounds; i++) {
    log(`\nround ${i}: the agent gets the card (it may change only ${f.source}/)`);
    const snapshot = new Map(changedEntries(f.cwd));
    const r = spawnSync(f.agent[0], f.agent.slice(1), { cwd: f.cwd, encoding: 'utf8', timeout: 900_000, input: last.card! });
    if (r.status !== 0) log(`  agent      exited ${r.status}: ${(r.stderr || r.stdout || '').trim().split('\n').slice(-2).join(' ').slice(0, 200)}`);
    writeFileSync(join(last.evidenceDir, `agent-round-${i}.txt`), `${r.stdout ?? ''}\n${r.stderr ?? ''}`);
    const after = changedEntries(f.cwd);
    const changed = after.filter(([p, st]) => snapshot.get(p) !== st || !snapshot.has(p)).map(([p]) => p).filter(p => !ignore.some(x => p.startsWith(x)));
    const outside = changed.filter(p => !p.startsWith(src));
    if (outside.length) {
      for (const p of outside) {
        const tracked = execSync(`git ls-files -- ${JSON.stringify(p)}`, { cwd: f.cwd, encoding: 'utf8' }).trim();
        if (tracked) execSync(`git checkout -- ${JSON.stringify(p)}`, { cwd: f.cwd }); else rmSync(join(f.cwd, p), { recursive: true, force: true });
      }
      log(`  REJECTED   the agent changed files outside ${f.source}/: ${outside.join(', ')} (restored)`);
      return { outcome: 'REJECTED', rounds: i, changedFiles: changed, recordingSha256: before, last };
    }
    if (recordingHash(testFile) !== before) {
      log('  REJECTED   the test or its recording changed');
      return { outcome: 'REJECTED', rounds: i, changedFiles: changed, recordingSha256: before, last };
    }
    log(`  changed    ${changed.join(', ') || '(nothing)'}`);
    writeFileSync(join(last.evidenceDir, `diff-round-${i}.patch`), execSync('git diff', { cwd: f.cwd, encoding: 'utf8' }));
    log(`  rebuild    ${f.build}`);
    execSync(f.build, { cwd: f.cwd, stdio: 'ignore' });
    last = await guard(cfg, testFile, log, { carryState: opts.carryState });
    if (last.decision.verdict === 'PASS') {
      log(`  PROVEN     the unchanged recording (sha256 ${before.slice(0, 12)}…) passes on the rebuilt app`);
      writeFileSync(join(last.evidenceDir, 'proof.json'), JSON.stringify({ outcome: 'PROVEN', rounds: i, changed, recordingSha256: before, test: relative(process.cwd(), testFile) }, null, 2));
      return { outcome: 'PROVEN', rounds: i, changedFiles: changed, recordingSha256: before, last };
    }
  }
  log('  FAILED     the fix did not pass within the round limit');
  return { outcome: 'FAILED', rounds, changedFiles: changedFiles(f.cwd), recordingSha256: before, last };
}
