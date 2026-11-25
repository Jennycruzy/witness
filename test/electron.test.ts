import { describe, expect, it } from 'vitest';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fill } from '../src/io/electron.js';
import { runKane, stripStartUrl } from '../src/io/kane.js';

/** Puts a fake kane-cli first on PATH for one call. */
async function withKane(script: string, f: (dir: string) => Promise<void>) {
  const dir = mkdtempSync(join(tmpdir(), 'witness-fakekane-'));
  writeFileSync(join(dir, 'kane-cli'), `#!/usr/bin/env node\n${script}`); chmodSync(join(dir, 'kane-cli'), 0o755);
  writeFileSync(join(dir, 'a_test.md'), '---\nmode: testing\nurl: http://127.0.0.1:1/\nmax_steps: 5\n---\n\n# a\n');
  const path = process.env.PATH; process.env.PATH = `${dir}:${path}`;
  try { await f(dir); } finally { process.env.PATH = path; }
}

describe('desktop app builds', () => {
  it('fills the scratch folder and profile into setup commands and arguments', () => {
    expect(fill('touch {data}/note.md', '/tmp/d', '/tmp/p')).toBe('touch /tmp/d/note.md');
    expect(fill('{data}/note.md --x={profile}', '/tmp/d', '/tmp/p')).toBe('/tmp/d/note.md --x=/tmp/p');
  });
  it('gives the miner\'s test writer the desktop app in place of the browser rule', async () => {
    const { writerPrompt } = await import('../src/commands/mine.js');
    const pr = { issues: [{ number: 1, title: 't', body: 'b', labels: [] }] } as any;
    const desk = writerPrompt({ where: 'The MarkText desktop app on Linux.' } as any, pr);
    expect(desk).toContain('- The MarkText desktop app on Linux.');
    expect(desk).not.toContain('Desktop Chrome, 1920x1080');
    expect(writerPrompt({} as any, pr)).toContain('Desktop Chrome, 1920x1080');
  });
  it('drives an open desktop window over its DevTools port with no start URL (Kane takes only http(s) ones)', async () => {
    const script = `const fs = require('fs'), path = require('path');
fs.writeFileSync(path.join(path.dirname(process.argv[1]), 'args'), process.argv.slice(2).join(' '));
fs.writeFileSync(path.join(path.dirname(process.argv[1]), 'seen.md'), fs.readFileSync(process.argv[4], 'utf8'));
console.log(JSON.stringify({ type: 'run_end', status: 'passed' }));`;
    await withKane(script, async d => {
      await runKane({ testFile: join(d, 'a_test.md'), url: 'file:///app/index.html', cdp: 'http://127.0.0.1:9333' });
      const args = readFileSync(join(d, 'args'), 'utf8');
      expect(args).toContain('--cdp-endpoint http://127.0.0.1:9333');
      expect(args).toContain('--allow-missing-url');
      expect(args).not.toContain('--override-start-url');
      const seen = readFileSync(join(d, 'seen.md'), 'utf8');
      expect(seen).not.toContain('url:');
      expect(seen).toContain('max_steps: 5');
      expect(readFileSync(join(d, 'a_test.md'), 'utf8')).toContain('url: http://127.0.0.1:1/');   // the user's test is untouched
    });
  });
  it('stops with an error, not a test result, when kane-cli refuses to start', async () => {
    await withKane(`console.error('error: --override-start-url must be http or https'); process.exit(2);`, async d => {
      await expect(runKane({ testFile: join(d, 'a_test.md'), url: 'http://x/', cdp: 'http://127.0.0.1:1' })).rejects.toThrow('kane-cli would not start: --override-start-url must be http or https');
    });
  });
  it('removes only the url line from a test\'s front matter', () => {
    expect(stripStartUrl('---\nmode: testing\nurl: http://x/\n---\n\n# t\nurl: in body\n')).toBe('---\nmode: testing\n---\n\n# t\nurl: in body\n');
    expect(stripStartUrl('# no front matter\n')).toBe('# no front matter\n');
  });
});
