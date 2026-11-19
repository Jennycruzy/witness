// Markdown summary of a guard run, for a pull request comment.
import { basename } from 'node:path';
import type { GuardResult } from '../commands/guard.js';

export function renderReport(results: GuardResult[]): string {
  const icon: Record<string, string> = { PASS: '✅', APP_BUG: '❌', TEST_PROBLEM: '🔧', ENV: '⚠️', STALE: '⚠️', UNKNOWN: '⚠️' };
  const out: string[] = ['### WITNESS', '', '| Test | Target | Reference | Kane\'s label | Verdict |', '|---|---|---|---|---|'];
  for (const r of results) {
    const label = r.decision.kaneLabel ? `${r.decision.kaneLabel} ${r.decision.kaneConfidence ?? ''}`.trim() : '—';
    out.push(`| \`${basename(r.test)}\` | ${r.target.status} | ${r.reference?.status ?? 'not needed'} | ${label} | ${icon[r.decision.verdict] ?? ''} **${r.decision.verdict}** |`);
  }
  for (const r of results) {
    if (r.blind.length) out.push('', `**BLIND** in \`${basename(r.test)}\`: ${r.blind.map(b => `${JSON.stringify(b.value)} (${b.reason})`).join('; ')}`);
    if (!r.card) continue;
    out.push('', `<details open><summary>Card for the coding agent: <code>${basename(r.test)}</code></summary>`, '', '```text', r.card, '```', '', '</details>');
  }
  out.push('', '_The same recording is replayed on this PR\'s build and on the base branch\'s build. Kane\'s label is shown, never used to decide._');
  return out.join('\n') + '\n';
}
