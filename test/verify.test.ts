import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { verify } from '../src/commands/verify.js';

describe('witness verify', () => {
  it('recomputes the headline numbers from the committed real runs and their sha256 manifest', () => {
    const lines: string[] = [];
    const code = verify(fileURLToPath(new URL('..', import.meta.url)), {}, s => lines.push(s));
    const out = lines.join('\n');
    expect(code).toBe(0);
    expect(out).toContain("Kane's label right on 4 of 9; WITNESS right on 9 of 9");
    expect(out).toContain('WITNESS right on 3 of 3');
    expect(out).toContain('Kane PASSED a real bug; WITNESS flagged 2 locked read(s)');
    expect(out).toContain('verify: OK');
  });
});
