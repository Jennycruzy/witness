import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { verify } from '../src/commands/verify.js';

describe('witness verify', () => {
  it('recomputes the headline numbers from the committed real runs and their sha256 manifest', () => {
    const lines: string[] = [];
    const code = verify(fileURLToPath(new URL('..', import.meta.url)), {}, s => lines.push(s));
    const out = lines.join('\n');
    expect(code).toBe(0);
    expect(out).toContain("Kane's label right on 2 of 4; WITNESS right on 4 of 4");
    expect(out).toContain('WITNESS right on 2 of 2');
    expect(out).toContain('verify: OK');
  });
});
