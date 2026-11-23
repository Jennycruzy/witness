// witness teach: writes WITNESS's verdict into Kane's bug memory, so Kane's next diagnosis of the same failure
// starts from the comparison instead of its own guess. It marks whether the bug is real and whether Kane's root
// cause was right, and adds one short note (Kane reads only the first 120 characters). It never closes a bug
// (done, not-a-bug, reopen): those are a person's decisions.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import type { Decision } from '../core/classify.js';
import { listBugs, markBug, noteBug, showBug, type KaneBug } from '../io/kanebugs.js';

export const NOTE_LIMIT = 120;

export interface TeachPlan { marks: string[]; note: string; }

/** What to tell Kane for a verdict, or null when the comparison settles nothing (ENV, STALE, PASS...). */
export function teachPlan(d: Decision, referenceName: string): TeachPlan | null {
  const fam = d.kaneLabel;
  const ref = referenceName.length > 30 ? referenceName.slice(0, 29) + '…' : referenceName;
  let p: TeachPlan | null = null;
  if (d.verdict === 'APP_BUG') p = { marks: ['real', fam === 'application_issue' ? 'rca-right' : 'rca-wrong'], note: `Real app bug, not the test: the same recording passes on ${ref} and fails here at a check.` };
  if (d.verdict === 'STATE_BUG') p = { marks: ['real', fam === 'application_issue' ? 'rca-right' : 'rca-wrong'], note: `Real app bug: fails only with data ${ref} saved; passes in a clean browser and on ${ref}.` };
  if (d.verdict === 'TEST_PROBLEM') p = { marks: ['not-real', fam === 'application_issue' ? 'rca-wrong' : 'rca-right'], note: `Test problem: the page changed where the test acts; the recording passes on ${ref}.` };
  if (p && p.note.length > NOTE_LIMIT) p.note = p.note.slice(0, NOTE_LIMIT - 1) + '…';
  return p;
}

/** Kane's session id for a run (it is the bug occurrence's run_key) and the bug it says it already knew. */
export function runIds(ndjson: string): { session: string | null; knownBug: string | null } {
  const session = ndjson.match(/"session_id":"([^"]+)"/)?.[1] ?? null;
  const knownBug = [...ndjson.matchAll(/"known_bug_id":"(BUG-\d+)"/g)].map(m => m[1]).pop() ?? null;
  return { session, knownBug };
}

const VOTE: Record<string, [string, string]> = { real: ['vote_real', '1'], 'not-real': ['vote_real', '-1'], 'rca-right': ['vote_rca', '1'], 'rca-wrong': ['vote_rca', '-1'] };

export interface TeachResult { bug: string | null; marked: string[]; noted: string | null; why?: string; }

export async function teach(evidenceDir: string, testFile: string, referenceName: string, log = console.log, targetPort?: number): Promise<TeachResult> {
  const dec = JSON.parse(readFileSync(join(evidenceDir, 'decision.json'), 'utf8'));
  const d: Decision = dec.decision;
  const plan = teachPlan(d, referenceName);
  const done = (r: TeachResult) => { writeFileSync(join(evidenceDir, 'teach.json'), JSON.stringify({ verdict: d.verdict, ...r, plan }, null, 2)); return r; };
  if (!plan) { log(`  teach      nothing to tell Kane for ${d.verdict}`); return done({ bug: null, marked: [], noted: null, why: `no teaching for ${d.verdict}` }); }
  const runFile = join(evidenceDir, 'target.ndjson');
  if (!existsSync(runFile)) return done({ bug: null, marked: [], noted: null, why: 'no target run' });
  const { session, knownBug } = runIds(readFileSync(runFile, 'utf8'));
  const cwd = dirname(testFile);
  let ref = knownBug, bug: KaneBug | null = null;
  if (!ref && session) {
    for (const b of await listBugs(basename(testFile), cwd)) {
      const full = await showBug(b.ref, cwd);
      if (full.occurrences?.some(o => o.run_key === session)) { ref = b.ref; bug = full; break; }
    }
  }
  if (!ref) { log('  teach      Kane filed no bug for this run, so there is nothing to mark'); return done({ bug: null, marked: [], noted: null, why: 'Kane filed no bug for this run' }); }
  bug = bug ?? await showBug(ref, cwd);
  const live = (bug.feedback ?? []).filter(f => !f.retired_at);
  const marked: string[] = [];
  for (const m of plan.marks) {
    const [type, value] = VOTE[m];
    if (live.some(f => f.type === type && f.value === value)) continue;   // already said
    await markBug(ref, m, cwd); marked.push(m);
  }
  const notes = live.filter(f => f.type === 'note').sort((a, b) => a.created_at.localeCompare(b.created_at));
  let noted: string | null = null;
  if (notes[notes.length - 1]?.text !== plan.note) { await noteBug(ref, plan.note, cwd); noted = plan.note; }
  log(`  teach      ${ref}: ${marked.length ? `marked ${marked.join(', ')}` : 'marks already set'}; ${noted ? `note "${noted}"` : 'note already there'}`);
  const keyPort = Number(bug.bug.card.page_pattern?.match(/:(\d+)\//)?.[1]);
  if (keyPort && keyPort !== targetPort) log(`  teach      Kane recalls ${ref} on ${bug.bug.card.page_pattern} only: serve the target on that same port (target "port" in witness.json)`);
  return done({ bug: ref, marked, noted });
}
