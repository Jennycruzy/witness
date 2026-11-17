// Published builds from the npm registry: list versions, download and unpack a tarball once (cached).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export async function listVersions(pkg: string): Promise<{ version: string; time: string }[]> {
  const r = await fetch(`https://registry.npmjs.org/${pkg.replace('/', '%2f')}`);
  if (!r.ok) throw new Error(`npm registry ${r.status} for ${pkg}`);
  const j: any = await r.json();
  return Object.keys(j.versions).map(v => ({ version: v, time: j.time?.[v] ?? '' })).sort((a, b) => a.time.localeCompare(b.time));
}

/** Returns the folder that holds the unpacked package (…/package). */
export async function fetchBuild(pkg: string, version: string, cacheDir: string): Promise<string> {
  const dir = join(cacheDir, `${pkg.replace(/[@/]/g, '_')}-${version}`);
  if (existsSync(join(dir, 'package'))) return join(dir, 'package');
  mkdirSync(dir, { recursive: true });
  const name = pkg.split('/').pop();
  const url = `https://registry.npmjs.org/${pkg}/-/${name}-${version}.tgz`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download ${r.status} ${url}`);
  const tgz = join(dir, 'build.tgz');
  const { writeFileSync } = await import('node:fs');
  writeFileSync(tgz, Buffer.from(await r.arrayBuffer()));
  execFileSync('tar', ['xzf', tgz, '-C', dir]);
  return join(dir, 'package');
}

export const isNightly = (v: string) => /nightly/.test(v);
export const isRelease = (v: string) => /^\d+\.\d+\.\d+$/.test(v);
