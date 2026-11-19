// Finds recorded checks that are locked to their own answer: Kane found the element BY the value it expects, then
// read that element's text back, so the read equals the expected value wherever that text sits on the page.
// Real case: TodoMVC javascript-es6, issue #2311. "The first todo is a" was recorded as: find the element whose text
// is "a", read its text, compare with "a". It passed while the list showed b, a.
import { readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

export interface LockedCheck { step: number; query: string; expected: string; locator: string; positional: boolean; }

/** Words that make a check about position or which item; a locked read cannot check those. */
export const POSITION_WORDS = /\b(first|second|third|last|top|bottom|order|before|after|next to|beside|above|below|which|selected|highlighted|latest|default|current)\b/i;

const PLAIN_TEXT_READ = /^\s*el\(\d+\)\.(textContent|innerText)(\.trim\(\))?\s*$/;
const COMPARE_READ = /^\s*el\(\d+\)\.(?:textContent|innerText)(?:\.trim\(\))?\s*===?\s*(['"])(.*)\1\s*$/;

function literals(locator: string): string[] {
  const out: string[] = [];
  const re = /(?:text|name|has-text)\s*=\s*"((?:[^"\\]|\\.)*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(locator))) out.push(m[1].replace(/\\"/g, '"'));
  return out;
}

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

/** One recorded analyze action -> a LockedCheck when its value is found by the value itself. */
export function lockedFromAction(a: any, step: number): LockedCheck | null {
  if (a?.action_type !== 'analyze') return null;
  const p = a.action_params ?? {};
  const expected = p.expected_value;
  if (typeof expected !== 'string' || !expected.trim() || typeof p.code_js !== 'string') return null;
  // Two recorded forms: read the text and compare it with the expected value, or compare inside the code
  // (`el(11).textContent.trim() === 'b'`, expected "true"). Either way the answer is fixed by the locator.
  const cmp = p.code_js.match(COMPARE_READ);
  const answer = PLAIN_TEXT_READ.test(p.code_js) ? expected : cmp && expected.trim() === 'true' ? cmp[2] : null;
  if (answer == null) return null;
  for (const loc of (p.locators ?? []) as string[]) {
    if (literals(String(loc)).some(l => norm(l) === norm(answer))) {
      const query = String(p.query ?? a.action_instruction ?? '');
      return { step, query, expected: answer, locator: String(loc), positional: POSITION_WORDS.test(`${query} ${p.condition ?? ''}`) };
    }
  }
  return null;
}

export interface LooseCheck { step: number; query: string; expected: string; }

/** A recorded check with an expected value but no code to read the page: Kane judged it by eye while recording,
 *  and a replay has nothing exact to compare, so it fails on every build (same class as kane-cli#214). */
export function looseFromAction(a: any, step: number): LooseCheck | null {
  if (a?.action_type !== 'analyze') return null;
  const p = a.action_params ?? {};
  if (p.expected_value == null || String(p.expected_value).trim() === '') return null;
  if (typeof p.code_js === 'string' && p.code_js.trim()) return null;
  return { step, query: String(p.query ?? p.condition ?? ''), expected: String(p.expected_value) };
}

/** Every recorded action of a test's saved recording, with its test step number. Free: reads files only. */
export function recordedActions(testFile: string): { step: number; action: any }[] {
  const name = basename(testFile).replace(/_test\.md$/, '');
  const stepsDir = join(dirname(testFile), `output-${name}`, '.internal', 'steps');
  const out: { step: number; action: any }[] = [];
  let steps: string[] = [];
  try { steps = readdirSync(stepsDir); } catch { return out; }
  for (const s of steps) {
    const step = Number(s.split('-')[0]);
    let flows: string[] = [];
    try { flows = readdirSync(join(stepsDir, s, 'flows')); } catch { continue; }
    for (const f of flows) {
      let text = '';
      try { text = readFileSync(join(stepsDir, s, 'flows', f, 'actions.ndjson'), 'utf8'); } catch { continue; }
      for (const line of text.split('\n')) { if (!line.trim()) continue; try { out.push({ step, action: JSON.parse(line) }); } catch { /* skip */ } }
    }
  }
  return out.sort((x, y) => x.step - y.step);
}

export function findLooseChecks(testFile: string): LooseCheck[] {
  return recordedActions(testFile).map(r => looseFromAction(r.action, r.step)).filter((x): x is LooseCheck => !!x);
}

/** Scans a test's saved recording (output-<name>/ next to the _test.md). Free: reads files only. */
export function findLockedChecks(testFile: string): LockedCheck[] {
  const name = basename(testFile).replace(/_test\.md$/, '');
  const stepsDir = join(dirname(testFile), `output-${name}`, '.internal', 'steps');
  const out: LockedCheck[] = [];
  let steps: string[] = [];
  try { steps = readdirSync(stepsDir); } catch { return out; }
  for (const s of steps) {
    const step = Number(s.split('-')[0]);
    let flows: string[] = [];
    try { flows = readdirSync(join(stepsDir, s, 'flows')); } catch { continue; }
    for (const f of flows) {
      let text = '';
      try { text = readFileSync(join(stepsDir, s, 'flows', f, 'actions.ndjson'), 'utf8'); } catch { continue; }
      for (const line of text.split('\n')) {
        if (!line.trim()) continue;
        let a: any; try { a = JSON.parse(line); } catch { continue; }
        const hit = lockedFromAction(a, step);
        if (hit) out.push(hit);
      }
    }
  }
  return out.sort((x, y) => x.step - y.step);
}
