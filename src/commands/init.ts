// witness init: look at a project, write witness.json for it, and (in the CLI) install the pinned Stop hook.
// Everything it guesses is printed, so a person can see and change it.
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { BuildRef, WitnessConfig } from '../io/config.js';

export interface InitOptions { reference?: string; npm?: string; buildDir?: string; }
export interface InitPlan { config: Omit<WitnessConfig, 'tests'> & { tests: string[] }; notes: string[]; }

const SKIP = new Set(['node_modules', '.git', '.witness', 'dist', 'build', 'out', '.next', 'coverage']);

/** Kane tests (*_test.md) under root, a few folders deep, not inside build output or Kane's own output folders. */
export function findTests(root: string, depth = 5): string[] {
  const out: string[] = [];
  const walk = (dir: string, d: number) => {
    if (d > depth) return;
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.isDirectory()) { if (!SKIP.has(e.name) && !e.name.startsWith('output-')) walk(join(dir, e.name), d + 1); }
      else if (e.name.endsWith('_test.md')) out.push(relative(root, join(dir, e.name)));
    }
  };
  walk(root, 0);
  return out.sort();
}

function buildCommand(root: string): string | null {
  let scripts: Record<string, string> = {};
  try { scripts = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts ?? {}; } catch { return null; }
  if (!scripts.build) return null;
  if (existsSync(join(root, 'pnpm-lock.yaml'))) return 'pnpm build';
  if (existsSync(join(root, 'yarn.lock'))) return 'yarn build';
  return 'npm run build';
}

function defaultBranch(root: string): string | null {
  try { return execSync('git symbolic-ref --short refs/remotes/origin/HEAD', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || null; }
  catch { /* no origin HEAD */ }
  for (const b of ['origin/main', 'origin/master']) {
    try { execSync(`git rev-parse --verify --quiet ${b}`, { cwd: root, stdio: 'ignore' }); return b; } catch { /* next */ }
  }
  return null;
}

/** What witness.json should say for the project in root. */
export function planInit(root: string, opts: InitOptions = {}, branch: string | null = defaultBranch(root)): InitPlan {
  const notes: string[] = [];
  const tests = findTests(root);
  if (!tests.length) notes.push('No Kane tests (*_test.md) found yet: write one with kane-cli, then add it to "tests".');

  const build = buildCommand(root);
  if (!build) notes.push('No "build" script in package.json: set "fix.build" (and the reference build) to the command that builds the app.');
  const dir = ['dist', 'build', 'out'].find(d => existsSync(join(root, d))) ?? 'dist';
  if (!existsSync(join(root, dir))) notes.push(`No build output folder found: assumed "${dir}". Build once, or change "target.dir".`);
  const source = existsSync(join(root, 'src')) ? 'src' : '.';

  let reference: BuildRef;
  if (opts.reference) { reference = { url: opts.reference }; }
  else if (opts.npm) { reference = { npm: opts.npm, ...(opts.buildDir ? { buildDir: opts.buildDir } : {}) }; notes.push(`Reference: the newest release of ${opts.npm} on npm.`); }
  else {
    const ref = branch ?? 'origin/main';
    if (!branch) notes.push('No origin/main or origin/master found: the reference assumes origin/main. Use --reference <url> for a staging site, or --npm <package> for the last release.');
    reference = { git: ref, build: build ?? 'npm run build', dir };
    notes.push(`Reference: ${ref}, built in its own worktree with "${build ?? 'npm run build'}". A pull request's base branch works the same way.`);
  }

  return {
    config: {
      tests,
      target: { dir },
      reference,
      fix: { agent: ['claude', '-p', '--allowedTools', 'Read,Edit,Glob,Grep'], cwd: '.', source, build: build ?? 'npm run build' },
    },
    notes,
  };
}
