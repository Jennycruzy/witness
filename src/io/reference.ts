// Turns a build description into a folder to serve, so a reference needs no manual setup:
//   { "npm": "@actual-app/web", "buildDir": "build" }            the newest release on npm (or "version": "x.y.z")
//   { "git": "origin/main", "build": "npm ci && npm run build", "dir": "dist" }   that git ref, built in a worktree
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fetchBuild, isRelease, listVersions } from './npm.js';
import type { BuildRef } from './config.js';

export async function resolveBuild(ref: BuildRef, cacheDir: string, log = console.log): Promise<BuildRef> {
  if (ref.npm) {
    let version = ref.version;
    if (!version) {
      const all = await listVersions(ref.npm);
      version = [...all].reverse().find(v => isRelease(v.version))?.version;
      if (!version) throw new Error(`no release of ${ref.npm} on npm`);
    }
    const pkg = await fetchBuild(ref.npm, version, cacheDir);
    log(`  build      ${ref.npm}@${version} from npm`);
    return { ...ref, dir: join(pkg, ref.buildDir ?? ''), label: `${ref.npm}@${version}` };
  }
  if (ref.git) {
    const repo = ref.repo ?? process.cwd();
    const sha = execSync(`git rev-parse ${JSON.stringify(ref.git)}`, { cwd: repo, encoding: 'utf8' }).trim();
    const wt = resolve(cacheDir, `git-${sha.slice(0, 12)}`);
    const out = join(wt, ref.dir ?? 'dist');
    if (!existsSync(out)) {
      mkdirSync(cacheDir, { recursive: true });
      if (!existsSync(wt)) execSync(`git worktree add --detach ${JSON.stringify(wt)} ${sha}`, { cwd: repo, stdio: 'ignore' });
      log(`  build      ${ref.git} (${sha.slice(0, 12)}): ${ref.build ?? '(no build command)'}`);
      if (ref.build) execSync(ref.build, { cwd: join(wt, ref.workdir ?? '.'), stdio: 'ignore' });
    }
    return { ...ref, dir: out, label: `${ref.git} (${sha.slice(0, 12)})` };
  }
  return ref;
}
