// witness.json: what to test, where the target and reference builds are, and how to fix and rebuild.
import { readFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';

export interface BuildRef { url?: string; dir?: string; isolation?: boolean; profile?: string; }

export interface FixConfig {
  agent: string[];      // command + args; the card text is sent on stdin
  cwd: string;          // the app's repo
  source: string;       // the only folder the agent may change (relative to cwd)
  build: string;        // shell command that rebuilds the target dir
  rounds?: number;
  ignore?: string[];    // build output the agent run may leave changed (default: dist/)
}

export interface WitnessConfig {
  tests: string[];
  target: BuildRef;
  reference: BuildRef;
  fix?: FixConfig;
  spec?: string;
  evidenceDir?: string;
}

export function loadConfig(path: string): WitnessConfig {
  const base = dirname(resolve(path));
  const c = JSON.parse(readFileSync(path, 'utf8')) as WitnessConfig;
  const abs = (p?: string) => (p && !isAbsolute(p) ? resolve(base, p) : p);
  c.tests = c.tests.map(t => abs(t)!);
  for (const b of [c.target, c.reference]) { b.dir = abs(b.dir); b.profile = abs(b.profile); }
  if (c.fix) c.fix.cwd = abs(c.fix.cwd)!;
  c.evidenceDir = abs(c.evidenceDir ?? '.witness/runs');
  return c;
}
