import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { changedSincePinned, findProjectDir, pinTests, pinsPath, stopHook } from '../src/commands/hook.js';
import { existsSync } from 'node:fs';
import type { WitnessConfig } from '../src/io/config.js';

function project() {
  const cwd = mkdtempSync(join(tmpdir(), 'witness-pin-'));
  const home = mkdtempSync(join(tmpdir(), 'witness-home-'));
  const test = join(cwd, 'menu_test.md');
  writeFileSync(test, '# menu\n\n## Open the menu\nClick Menu.\n');
  mkdirSync(join(cwd, 'output-menu'));
  writeFileSync(join(cwd, 'output-menu', 'actions.ndjson'), '{"step":1}\n');
  const cfg = { tests: [test] } as unknown as WitnessConfig;
  return { cwd, home, test, cfg };
}

describe('Stop hook pins the tests', () => {
  it('stores the pins outside the project', () => {
    const { cwd, home, cfg } = project();
    pinTests(cfg, cwd, home);
    expect(pinsPath(cwd, home).startsWith(home)).toBe(true);
    expect(pinsPath(cwd, home).startsWith(cwd)).toBe(false);
  });
  it('sees nothing changed right after pinning', () => {
    const { cwd, home, cfg } = project();
    pinTests(cfg, cwd, home);
    expect(changedSincePinned(cfg, cwd, home)).toEqual([]);
  });
  it('catches an edited test', () => {
    const { cwd, home, cfg, test } = project();
    pinTests(cfg, cwd, home);
    writeFileSync(test, '# menu\n\n## Open the menu\nClick Menu twice, then wait.\n');
    expect(changedSincePinned(cfg, cwd, home)).toEqual(['menu_test.md']);
  });
  it('catches an edited recording', () => {
    const { cwd, home, cfg } = project();
    pinTests(cfg, cwd, home);
    writeFileSync(join(cwd, 'output-menu', 'actions.ndjson'), '{"step":1,"healed":true}\n');
    expect(changedSincePinned(cfg, cwd, home)).toEqual(['menu_test.md']);
  });
  it('checks nothing when no pins were made', () => {
    const { cwd, home, cfg, test } = project();
    writeFileSync(test, 'changed');
    expect(changedSincePinned(cfg, cwd, home)).toEqual([]);
  });
});

describe('Stop hook finds the project', () => {
  it('when the agent has moved into a subfolder', () => {
    const { cwd } = project();
    writeFileSync(join(cwd, 'witness.json'), '{}');
    const sub = join(cwd, 'kane-run', 'tests', 'a'); mkdirSync(sub, { recursive: true });
    expect(findProjectDir(sub, '')).toBe(cwd);
  });
  it("from Claude Code's project folder first", () => {
    const { cwd } = project();
    writeFileSync(join(cwd, 'witness.json'), '{}');
    expect(findProjectDir(tmpdir(), cwd)).toBe(cwd);
  });
  it('returns nothing when there is no witness.json', () => {
    const { cwd } = project();
    expect(findProjectDir(cwd, '')).toBe(null);
  });
});

describe('Stop hook fails closed', () => {
  it('blocks the stop when WITNESS cannot check the fix', async () => {
    const { cwd } = project();
    writeFileSync(join(cwd, 'witness.json'), '{"not": "a witness config"}');
    const here = process.cwd();
    expect(await stopHook(JSON.stringify({ cwd }))).toBe(2);
    expect(process.cwd()).toBe(here);
    expect(existsSync(join(cwd, '.witness', 'PROVEN.md'))).toBe(false);
  });
  it('hands over to a person when the same failure repeats', async () => {
    const { cwd } = project();
    writeFileSync(join(cwd, 'witness.json'), '{"not": "a witness config"}');
    expect(await stopHook(JSON.stringify({ cwd }))).toBe(2);
    expect(await stopHook(JSON.stringify({ cwd, stop_hook_active: true }))).toBe(2);
    expect(await stopHook(JSON.stringify({ cwd, stop_hook_active: true }))).toBe(0);
    expect(existsSync(join(cwd, '.witness', 'HUMAN_NEEDED.md'))).toBe(true);
  });
});
