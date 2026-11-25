// Turns a build description into a folder to serve, so a reference needs no manual setup:
//   { "npm": "@actual-app/web", "buildDir": "build" }            the newest release on npm (or "version": "x.y.z")
//   { "git": "origin/main", "build": "npm ci && npm run build", "dir": "dist" }   that git ref, built in a worktree
import { execFileSync, execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
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
  if (ref.release) {
    const dir = await fetchRelease(ref.release, ref.tag!, ref.asset ?? '\\.(zip|tar\\.gz|tgz)$', cacheDir, ref.electron ? ref.electron.bin : 'index.html');
    log(`  build      ${ref.release}@${ref.tag} (GitHub release)`);
    return { ...ref, dir: ref.dir ? join(dir, ref.dir) : dir, label: ref.label ?? `${ref.release}@${ref.tag}` };
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

/** Downloads and unpacks a release asset once; returns the folder that holds index.html (the shallowest one). */
export async function fetchRelease(repo: string, tag: string, assetPattern: string, cacheDir: string, find = 'index.html'): Promise<string> {
  const root = resolve(cacheDir, `${repo.replace('/', '_')}-${tag}`);
  const done = join(root, '.unpacked');
  if (!existsSync(done)) {
    const rr = await fetch(`https://api.github.com/repos/${repo}/releases/tags/${encodeURIComponent(tag)}`, { headers: { accept: 'application/vnd.github+json' } });
    if (!rr.ok) throw new Error(`GitHub ${rr.status} for ${repo}@${tag}`);
    const rel: any = await rr.json();
    const a = (rel.assets as any[]).map(x => ({ name: x.name as string, url: x.browser_download_url as string })).find(x => new RegExp(assetPattern).test(x.name));
    if (!a) throw new Error(`no asset matching ${assetPattern} in ${repo}@${tag}`);
    mkdirSync(root, { recursive: true });
    const r = await fetch(a.url);
    if (!r.ok) throw new Error(`download ${r.status} ${a.url}`);
    const file = join(root, a.name);
    writeFileSync(file, Buffer.from(await r.arrayBuffer()));
    if (/\.zip$/.test(a.name)) execFileSync('python3', ['-m', 'zipfile', '-e', file, join(root, 'x')]);
    else { mkdirSync(join(root, 'x'), { recursive: true }); execFileSync('tar', ['xzf', file, '-C', join(root, 'x')]); }
    // Single-page builds ship as one named .html file (CyberChef_v10.23.0.html): serve it as index.html.
    const x = join(root, 'x');
    if (find === 'index.html' && !findIndex(x, 0)) {
      const html = readdirSync(x).find(f => /\.html$/.test(f));
      if (html) copyFileSync(join(x, html), join(x, 'index.html'));
    }
    writeFileSync(done, a.name);
  }
  const found = findIndex(join(root, 'x'), 0, find);
  if (!found) throw new Error(`no ${find} in ${repo}@${tag}`);
  return found;
}

function findIndex(dir: string, depth: number, name = 'index.html'): string | null {
  if (existsSync(join(dir, name)) && !statSync(join(dir, name)).isDirectory()) return dir;
  if (depth > 3) return null;
  for (const e of readdirSync(dir)) { const p = join(dir, e); if (statSync(p).isDirectory()) { const f = findIndex(p, depth + 1, name); if (f) return f; } }
  return null;
}
