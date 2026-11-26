// Claude Code Stop hook. Exit 2 blocks the stop and Claude reads stderr as the reason (Claude Code hooks docs).
// It stops blocking when the same verdict repeats 3 times while the hook keeps the turn going.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, join, relative, resolve } from 'node:path';
import { loadConfig, type WitnessConfig } from '../io/config.js';
import { recordingHash } from '../io/kane.js';
import { guard } from './guard.js';

/** Where the pins for a project live: outside the project, so an agent editing the repo does not move them. */
export function pinsPath(cwd: string, home = process.env.WITNESS_HOME ?? join(process.env.HOME ?? '.', '.witness')): string {
  return join(home, 'pins', createHash('sha256').update(resolve(cwd)).digest('hex').slice(0, 16) + '.json');
}

/** The folder that holds witness.json: Claude Code's project folder, else the nearest one up from where the agent is now
 *  (an agent that cd'd into a subfolder must not slip past the hook). */
export function findProjectDir(cwd: string, projectDir = process.env.CLAUDE_PROJECT_DIR): string | null {
  if (projectDir && existsSync(join(projectDir, 'witness.json'))) return resolve(projectDir);
  for (let d = resolve(cwd); ; d = dirname(d)) {
    if (existsSync(join(d, 'witness.json'))) return d;
    if (dirname(d) === d) return null;
  }
}

/** Pin every test and its recording (sha256), as they are now. */
export function pinTests(cfg: WitnessConfig, cwd: string, home?: string): Record<string, string> {
  const pins = Object.fromEntries(cfg.tests.map(t => [relative(cwd, t), recordingHash(t)]));
  const p = pinsPath(cwd, home); mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify({ cwd: resolve(cwd), pinned: new Date().toISOString(), pins }, null, 2) + '\n');
  return pins;
}

/** The tests whose file or recording changed since they were pinned. */
export function changedSincePinned(cfg: WitnessConfig, cwd: string, home?: string): string[] {
  const p = pinsPath(cwd, home);
  if (!existsSync(p)) return [];
  const { pins } = JSON.parse(readFileSync(p, 'utf8')) as { pins: Record<string, string> };
  return cfg.tests.map(t => relative(cwd, t)).filter(t => t in pins && recordingHash(resolve(cwd, t)) !== pins[t]);
}

interface HookInput { stop_hook_active?: boolean; session_id?: string; cwd?: string; }

export async function stopHook(stdin: string, maxRepeats = 3, opts: { carryState?: boolean } = {}): Promise<number> {
  let input: HookInput = {};
  try { input = JSON.parse(stdin || '{}'); } catch { /* run anyway */ }
  const cwd = findProjectDir(input.cwd ?? process.cwd());
  if (!cwd) return 0;
  // Fail closed: if WITNESS cannot check the fix, the agent cannot claim it is done.
  const before = process.cwd();
  try { return await checkBeforeStop(cwd, input, maxRepeats, opts); }
  catch (e) {
    const why = `WITNESS could not check the fix, so it does not count yet: ${String((e as Error)?.message ?? e).slice(0, 1500)}`;
    return blockOrHandOver(cwd, input, why, maxRepeats);
  }
  finally { process.chdir(before); }
}

/** Block the stop with `why`, unless the same reason has already repeated maxRepeats times: then a person takes over. */
function blockOrHandOver(cwd: string, input: HookInput, why: string, maxRepeats: number): number {
  const stateDir = join(cwd, '.witness'); mkdirSync(stateDir, { recursive: true });
  const statePath = join(stateDir, 'hook-state.json');
  const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : { last: '', repeats: 0 };
  if (!input.stop_hook_active) { state.last = ''; state.repeats = 0; }
  state.repeats = state.last === why ? state.repeats + 1 : 1;
  state.last = why;
  writeFileSync(statePath, JSON.stringify(state));
  if (input.stop_hook_active && state.repeats >= maxRepeats) {
    writeFileSync(join(stateDir, 'HUMAN_NEEDED.md'), `The same WITNESS result repeated ${state.repeats} times.\n\n${why}\n`);
    return 0;
  }
  process.stderr.write(`${why}\n`);
  return 2;
}

async function checkBeforeStop(cwd: string, input: HookInput, maxRepeats: number, opts: { carryState?: boolean }): Promise<number> {
  process.chdir(cwd); // setup commands and relative paths in witness.json are relative to the project, not to where the agent is
  const cfgPath = join(cwd, 'witness.json');
  const cfg = loadConfig(cfgPath);
  const stateDir = join(cwd, '.witness'); mkdirSync(stateDir, { recursive: true });
  rmSync(join(stateDir, 'PROVEN.md'), { force: true }); // a proof is only ever for the code as it is now
  const statePath = join(stateDir, 'hook-state.json');
  const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : { last: '', repeats: 0 };
  if (!input.stop_hook_active) { state.last = ''; state.repeats = 0; }

  const changed = changedSincePinned(cfg, cwd);
  if (changed.length) {
    process.stderr.write(`WITNESS: these Kane tests or their recordings changed since they were pinned: ${changed.join(', ')}.\nA fix only counts when the unchanged recording passes on the rebuilt app. Put the test and its recording back (git checkout -- <test> output-<name>/) and fix the app. If the test itself is wrong, a person re-pins it with \`witness pin\`.\n`);
    return 2;
  }
  if (cfg.fix?.build) {
    try { execSync(cfg.fix.build, { cwd: cfg.fix.cwd, stdio: 'pipe' }); }
    catch (e: any) { process.stderr.write(`WITNESS: the app does not build, so it cannot be checked yet.\n${String(e.stderr || e.message).slice(-1500)}\n`); return 2; }
  }
  const quiet: string[] = [];
  const problems: string[] = [];
  for (const t of cfg.tests) {
    const r = await guard(cfg, t, (s) => quiet.push(s), { carryState: opts.carryState });
    if (r.decision.verdict === 'APP_BUG' || r.decision.verdict === 'STATE_BUG' || r.decision.verdict === 'TEST_PROBLEM') problems.push(r.card ?? r.decision.why);
    else if (r.decision.verdict !== 'PASS') problems.push(`${relative(cwd, t)}: ${r.decision.verdict}. ${r.decision.why} ${r.decision.next ?? ''}`.trim()); // not a pass, so not proven
    for (const l of r.locked.filter(x => x.positional && x.kind === 'locator')) problems.push(`LOCKED check in ${t}, test step ${l.step}: Kane finds the element by the text it expects (${JSON.stringify(l.expected)}) and reads it back, so this step passes wherever that text is, even on the wrong item or in the wrong place. Rewrite the step so it states what must be true about position or the whole list (for example: "the todo list reads, from top to bottom: a, b"), then re-record it with witness record.`);
    for (const b of r.blind) problems.push(`BLIND check in ${t}, test step ${Number(b.runId.replace('run-', '')) + 1}: it passed reading ${JSON.stringify(b.value)}; ${b.reason}. Make that step check each item separately (or count items), then re-record it.`);
  }
  if (!problems.length) {
    writeFileSync(statePath, JSON.stringify({ last: '', repeats: 0 }));
    const proof = cfg.tests.map(t => `- ${relative(cwd, t)}: passes; recording sha256 ${recordingHash(t).slice(0, 12)}…`).join('\n');
    writeFileSync(join(stateDir, 'PROVEN.md'), `WITNESS: every Kane test passes on the rebuilt app, with the pinned, unchanged recordings.\n\n${proof}\n`);
    return 0;
  }

  const key = problems.join('\n---\n');
  state.repeats = state.last === key ? state.repeats + 1 : 1;
  state.last = key;
  writeFileSync(statePath, JSON.stringify(state));
  if (input.stop_hook_active && state.repeats >= maxRepeats) {
    writeFileSync(join(stateDir, 'HUMAN_NEEDED.md'), `The same WITNESS verdict repeated ${state.repeats} times.\n\n${key}\n`);
    return 0; // let the turn end; a person takes over with the record
  }
  process.stderr.write(`WITNESS checked Kane's failure against the reference build before you stop.\n\n${key}\n`);
  return 2;
}
