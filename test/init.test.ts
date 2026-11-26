import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findTests, planInit } from '../src/commands/init.js';

function app(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), 'witness-init-'));
  for (const [p, c] of Object.entries(files)) { mkdirSync(join(root, p, '..'), { recursive: true }); writeFileSync(join(root, p), c); }
  return root;
}

describe('witness init', () => {
  it('finds Kane tests, not the copies in output folders or node_modules', () => {
    const root = app({ 'e2e/cart_test.md': '#', 'e2e/output-cart/x_test.md': '#', 'node_modules/p/y_test.md': '#', 'login_test.md': '#' });
    expect(findTests(root)).toEqual(['e2e/cart_test.md', 'login_test.md']);
  });
  it('a Vite app on main: target dist, reference origin/main built the same way, agent limited to src', () => {
    const root = app({ 'package.json': '{"scripts":{"build":"vite build"}}', 'src/main.ts': '', 'dist/index.html': '', 'e2e/cart_test.md': '#' });
    const { config, notes } = planInit(root, {}, 'origin/main');
    expect(config.tests).toEqual(['e2e/cart_test.md']);
    expect(config.target).toEqual({ dir: 'dist' });
    expect(config.reference).toEqual({ git: 'origin/main', build: 'npm run build', dir: 'dist' });
    expect(config.fix).toMatchObject({ source: 'src', build: 'npm run build', cwd: '.' });
    expect(notes.join(' ')).toContain('origin/main');
  });
  it('uses the project package manager and its output folder', () => {
    const root = app({ 'package.json': '{"scripts":{"build":"react-scripts build"}}', 'yarn.lock': '', 'build/index.html': '' });
    const { config } = planInit(root, {}, 'origin/master');
    expect(config.target.dir).toBe('build');
    expect(config.fix?.build).toBe('yarn build');
    expect(config.reference.git).toBe('origin/master');
  });
  it('a staging URL or the last npm release as the reference', () => {
    const root = app({ 'package.json': '{"scripts":{"build":"x"}}' });
    expect(planInit(root, { reference: 'https://staging.example.com/' }, null).config.reference).toEqual({ url: 'https://staging.example.com/' });
    expect(planInit(root, { npm: '@actual-app/web', buildDir: 'build' }, null).config.reference).toEqual({ npm: '@actual-app/web', buildDir: 'build' });
  });
  it('says what it could not find instead of guessing silently', () => {
    const { notes } = planInit(app({}), {}, null);
    const all = notes.join('\n');
    expect(all).toContain('No Kane tests');
    expect(all).toContain('No "build" script');
    expect(all).toContain('No build output folder');
  });
});
