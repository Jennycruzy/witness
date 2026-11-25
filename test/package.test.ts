// The published package must hold every file `witness verify` and `witness demo` read (npx github:... installs it).
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('package contents', () => {
  it('ships every file in evidence/manifest.json', () => {
    const pack = JSON.parse(execSync('npm pack --dry-run --json --ignore-scripts', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }))[0];
    const files = new Set(pack.files.map((f: { path: string }) => f.path));
    const missing = Object.keys(JSON.parse(readFileSync('evidence/manifest.json', 'utf8'))).filter(f => !files.has(f));
    expect(missing).toEqual([]);
  }, 60_000);
});
