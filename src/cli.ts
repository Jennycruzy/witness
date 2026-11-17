#!/usr/bin/env node
// witness classify <target.ndjson> <reference.ndjson>
// Compares two Kane runs of the same recording and says whether to fix the app or the test.
import { readFileSync } from 'node:fs';
import { parseRun } from './core/stream.js';
import { classify, labelDisagrees } from './core/classify.js';

const [cmd, targetPath, referencePath] = process.argv.slice(2);
if (cmd !== 'classify' || !targetPath || !referencePath) {
  console.error('usage: witness classify <target.ndjson> <reference.ndjson>');
  process.exit(64);
}
const target = parseRun(readFileSync(targetPath, 'utf8'));
const reference = parseRun(readFileSync(referencePath, 'utf8'));
const d = classify(target, reference);
const step = target.failed ? `step ${target.failed.stepIndex ?? '?'} (${target.failed.kind})` : '';
console.log(`  reference  ${reference.status.toUpperCase()}`);
console.log(`  target     ${target.status.toUpperCase()} ${step}`);
if (d.kaneLabel) console.log(`  Kane label ${d.kaneLabel} ${d.kaneConfidence ?? ''}${labelDisagrees(d) ? '   <- disagrees with the comparison' : ''}`);
console.log(`  VERDICT    ${d.verdict}: ${d.why}`);
console.log(`  next       ${d.next}`);
process.exit(d.verdict === 'APP_BUG' || d.verdict === 'TEST_PROBLEM' ? 2 : 0);
