import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { verify } from '../src/commands/verify.js';

describe('witness verify', () => {
  it('recomputes the headline numbers from the committed real runs and their sha256 manifest', () => {
    const lines: string[] = [];
    const code = verify(fileURLToPath(new URL('..', import.meta.url)), {}, s => lines.push(s));
    const out = lines.join('\n');
    expect(code).toBe(0);
    expect(out).toContain("Kane's label right on 6 of 12; WITNESS right on 12 of 12");
    expect(out).toContain("mined regressions:  Kane's label right on 15 of 16; WITNESS right on 16 of 16");
    expect(out).toContain('WITNESS right on 3 of 3');
    expect(out).toContain('WITNESS said ENV on 1 of 1');
    expect(out).toContain('Kane PASSED a real bug; WITNESS flagged 2 locked read(s)');
    expect(out).toContain('verify: OK');
  });
});
