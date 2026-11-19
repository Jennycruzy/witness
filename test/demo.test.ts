import { describe, expect, it } from 'vitest';
import { demo } from '../src/commands/demo.js';

describe('witness demo', () => {
  it('walks the real svelte case and recomputes every number from evidence/', () => {
    const out: string[] = [];
    const code = demo(process.cwd(), (s: string) => out.push(s));
    const text = out.join('\n');
    expect(code).toBe(0);
    expect(text).toContain('VERDICT    APP_BUG');
    expect(text).toMatch(/automation_bug.*0\.88/);
    expect(text).toContain('+        const value = event.target.value.trim();');
    expect(text).toMatch(/UNCHANGED recording: PASSED 5\/5/);
    expect(text).toContain("Kane's label right on 4 of 9; WITNESS right on 9 of 9");
    expect(text).toContain('verify: OK');
  });
});
