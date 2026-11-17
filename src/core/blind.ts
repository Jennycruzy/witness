// Finds checks that passed while reading text a person would see as extra content
// (blank or whitespace-only lines, surrounding spaces) that the check's comparison strips away.
// Real case: TodoMVC svelte, issue #2315: "exactly one todo, b" passed reading "\nb" while a blank todo was listed.

export interface BlindCheck { runId: string; variable: string; value: string; reason: string; }

export function hiddenTextReason(value: string): string | null {
  if (typeof value !== 'string' || !value.length) return null;
  const lines = value.split('\n');
  if (lines.length > 1 && lines.some(l => l.trim() === '')) return 'the value has blank lines that the comparison strips, so an empty item on the page is invisible to this check';
  if (value !== value.trim()) return 'the value has leading or trailing spaces that the comparison strips';
  return null;
}

export function findBlindChecks(ndjson: string): BlindCheck[] {
  const out: BlindCheck[] = [];
  for (const line of ndjson.split('\n')) {
    if (!line.includes('"type":"run_end"')) continue;
    let ev: any; try { ev = JSON.parse(line); } catch { continue; }
    if (ev.status !== 'passed' || !ev.variables_out) continue;
    for (const [k, v] of Object.entries<any>(ev.variables_out)) {
      const value = v && typeof v === 'object' ? v.value : v;
      if (!/check/i.test(k) || typeof value !== 'string') continue;   // only values read by a check step
      const reason = hiddenTextReason(value);
      if (reason) out.push({ runId: String(ev.run_id ?? ''), variable: k, value, reason });
    }
  }
  return out;
}
