// witness.json: what to test, where the target and reference builds are, and how to fix and rebuild.
import { readFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';

export interface BuildRef {
  url?: string; dir?: string; isolation?: boolean; profile?: string; setup?: string;
  npm?: string; version?: string; buildDir?: string;          // a published build on npm (newest release when no version)
  git?: string; build?: string; repo?: string; workdir?: string; // a git ref, built in a worktree; dir = its output folder
  kane?: { target: 'emulator' | 'simulator' | 'android' | 'ios'; app: string; deviceName?: string; osVersion?: string };  // a mobile app build instead of a web page
  label?: string;
}

/** A published build channel on npm (for nightly watch and search). */
export interface NpmSource {
  npm: string;            // package name, e.g. @actual-app/web
  buildDir?: string;      // folder inside the package to serve, e.g. build
  isolation?: boolean;    // serve with cross-origin isolation headers
  setup?: string;         // command that prepares app state: gets {url} and {profile}
  repo?: string;          // GitHub owner/name, to list the commits between two builds
}

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
  nightly?: NpmSource;
  cacheDir?: string;
}

export function loadConfig(path: string): WitnessConfig {
  const base = dirname(resolve(path));
  const c = JSON.parse(readFileSync(path, 'utf8')) as WitnessConfig;
  const abs = (p?: string) => (p && !isAbsolute(p) ? resolve(base, p) : p);
  c.tests = c.tests.map(t => abs(t)!);
  for (const b of [c.target, c.reference]) { if (!b.git) b.dir = abs(b.dir); b.profile = abs(b.profile); b.repo = abs(b.repo); if (b.kane?.app && !/^APP/.test(b.kane.app)) b.kane.app = abs(b.kane.app)!; }
  if (c.fix) c.fix.cwd = abs(c.fix.cwd)!;
  c.evidenceDir = abs(c.evidenceDir ?? '.witness/runs');
  c.cacheDir = abs(c.cacheDir ?? '.witness/builds');
  return c;
}
