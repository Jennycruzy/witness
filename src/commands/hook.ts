// Claude Code Stop hook. Exit 2 blocks the stop and Claude reads stderr as the reason (Claude Code hooks docs).
// It stops blocking when the same verdict repeats 3 times while the hook keeps the turn going.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig } from '../io/config.js';
import { guard } from './guard.js';

interface HookInput { stop_hook_active?: boolean; session_id?: string; cwd?: string; }

export async function stopHook(stdin: string, maxRepeats = 3): Promise<number> {
  let input: HookInput = {};
  try { input = JSON.parse(stdin || '{}'); } catch { /* run anyway */ }
  const cwd = input.cwd ?? process.cwd();
  const cfgPath = join(cwd, 'witness.json');
  if (!existsSync(cfgPath)) return 0;
  const cfg = loadConfig(cfgPath);
  const stateDir = join(cwd, '.witness'); mkdirSync(stateDir, { recursive: true });
  const statePath = join(stateDir, 'hook-state.json');
  const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : { last: '', repeats: 0 };
  if (!input.stop_hook_active) { state.last = ''; state.repeats = 0; }

  const quiet: string[] = [];
  const problems: string[] = [];
  for (const t of cfg.tests) {
    const r = await guard(cfg, t, (s) => quiet.push(s));
    if (r.decision.verdict === 'APP_BUG' || r.decision.verdict === 'TEST_PROBLEM') problems.push(r.card ?? r.decision.why);
  }
  if (!problems.length) { writeFileSync(statePath, JSON.stringify({ last: '', repeats: 0 })); return 0; }

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
