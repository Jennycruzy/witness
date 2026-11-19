#!/usr/bin/env node
// witness guard [witness.json]          run each test on the target; on failure compare with the reference
// witness fix <test> [witness.json]     app bug -> agent fix -> rebuild -> prove with the unchanged recording
// witness record <test> [witness.json]   record the test's steps with Kane on the reference build (or newest release)
// witness classify <target.ndjson> <reference.ndjson>   decide from two saved Kane runs
// witness demo                           one real case from the committed runs, then every number recomputed (no login)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseRun } from './core/stream.js';
import { classify, labelDisagrees } from './core/classify.js';
import { loadConfig } from './io/config.js';
import { guard } from './commands/guard.js';
import { fix } from './commands/fix.js';
import { stopHook } from './commands/hook.js';
import { watch } from './commands/watch.js';
import { search } from './commands/search.js';
import { listVersions } from './io/npm.js';
import { verify } from './commands/verify.js';
import { record } from './commands/record.js';
import { demo, evidenceRoot } from './commands/demo.js';

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
  if (cmd === 'record' && a) {
    const r = await record(loadConfig(b ?? 'witness.json'), resolve(a));
    return r.ok ? 0 : 2;
  }
  if (cmd === 'demo') return demo();
  if (cmd === 'verify') return verify(evidenceRoot(), { writeManifest: a === '--write-manifest' });
  if (cmd === 'watch') {
    const r = await watch(loadConfig(a ?? 'witness.json'));
    return r.results.some((x: any) => x.verdict === 'APP_BUG') ? 2 : 0;
  }
  if (cmd === 'search' && a) {
    // witness search <test_md> <from-version> <to-version> [witness.json]
    const [, , from, to, cfgPath] = process.argv.slice(2);
    const cfg = loadConfig(cfgPath ?? 'witness.json');
    if (!cfg.nightly || !from || !to) { console.error('usage: witness search <test_md> <good-version> <bad-version> [witness.json]'); return 64; }
    const all = await listVersions(cfg.nightly.npm);
    const i = all.findIndex(v => v.version === from), j = all.findIndex(v => v.version === to);
    const span = all.slice(i, j + 1).filter((v, k, arr) => k === 0 || k === arr.length - 1 || /nightly/.test(v.version));
    console.log(`search ${cfg.nightly.npm}: ${span.length} builds from ${from} (good) to ${to} (bad)`);
    const r = await search(cfg.nightly, span, resolve(a), cfg.cacheDir!);
    console.log(`  first bad ${r.firstBad}  (last good ${r.lastGood})`);
    for (const c of r.commits) console.log(`    ${c.sha} ${c.date} ${c.title}`);
    return 0;
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
  console.error('usage: witness demo | witness verify | witness guard [witness.json] | witness record <test_md> [witness.json] | witness fix <test_md> [witness.json] | witness hook | witness install-hook | witness classify <target.ndjson> <reference.ndjson>');
  return 64;
}

main().then(c => process.exit(c), e => { console.error(e?.message ?? e); process.exit(1); });
