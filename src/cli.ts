#!/usr/bin/env node
// witness guard [witness.json]          run each test on the target; on failure compare with the reference
// witness fix <test> [witness.json]     app bug -> agent fix -> rebuild -> prove with the unchanged recording
// witness classify <target.ndjson> <reference.ndjson>   decide from two saved Kane runs
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseRun } from './core/stream.js';
import { classify, labelDisagrees } from './core/classify.js';
import { loadConfig } from './io/config.js';
import { guard } from './commands/guard.js';
import { fix } from './commands/fix.js';
import { stopHook } from './commands/hook.js';

const [cmd, a, b] = process.argv.slice(2);

async function main(): Promise<number> {
  if (cmd === 'classify' && a && b) {
    const target = parseRun(readFileSync(a, 'utf8'));
    const reference = parseRun(readFileSync(b, 'utf8'));
    const d = classify(target, reference);
    console.log(`  reference  ${reference.status.toUpperCase()}`);
    console.log(`  target     ${target.status.toUpperCase()}${target.failed ? ` (${target.failed.kind})` : ''}`);
    if (d.kaneLabel) console.log(`  Kane label ${d.kaneLabel} ${d.kaneConfidence ?? ''}${labelDisagrees(d) ? '   <- disagrees with the comparison' : ''}`);
    console.log(`  VERDICT    ${d.verdict}: ${d.why}`);
    console.log(`  next       ${d.next}`);
    return d.verdict === 'APP_BUG' || d.verdict === 'TEST_PROBLEM' ? 2 : 0;
  }
  if (cmd === 'guard') {
    const cfg = loadConfig(a ?? 'witness.json');
    let code = 0;
    for (const t of cfg.tests) { const r = await guard(cfg, t); if (r.decision.verdict !== 'PASS') code = 2; }
    return code;
  }
  if (cmd === 'fix' && a) {
    const cfg = loadConfig(b ?? 'witness.json');
    const r = await fix(cfg, resolve(a));
    return r.outcome === 'PROVEN' ? 0 : 2;
  }
  if (cmd === 'hook') {
    const stdin = await new Promise<string>(res => { let s = ''; process.stdin.on('data', d => { s += d; }); process.stdin.on('end', () => res(s)); });
    return stopHook(stdin);
  }
  if (cmd === 'install-hook') {
    const settings = resolve('.claude/settings.json');
    mkdirSync(dirname(settings), { recursive: true });
    const cur = existsSync(settings) ? JSON.parse(readFileSync(settings, 'utf8')) : {};
    cur.hooks = cur.hooks ?? {};
    const command = `node ${JSON.stringify(resolve(process.argv[1]))} hook`;
    const already = JSON.stringify(cur.hooks.Stop ?? []).includes(' hook');
    if (!already) (cur.hooks.Stop = cur.hooks.Stop ?? []).push({ hooks: [{ type: 'command', command, timeout: 1200 }] });
    writeFileSync(settings, JSON.stringify(cur, null, 2) + '\n');
    console.log(already ? 'The WITNESS Stop hook is already installed.' : `Installed the WITNESS Stop hook in ${settings}`);
    return 0;
  }
  console.error('usage: witness guard [witness.json] | witness fix <test_md> [witness.json] | witness hook | witness install-hook | witness classify <target.ndjson> <reference.ndjson>');
  return 64;
}

main().then(c => process.exit(c), e => { console.error(e?.message ?? e); process.exit(1); });
