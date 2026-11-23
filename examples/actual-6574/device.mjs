// One device of the Actual #6574 story, driven with Playwright in its own Chrome profile.
// Usage: node device.mjs <url> <chrome-profile-dir> <bootstrap|create|import <csv>|open|login|upgrade>
//   bootstrap  first visit: set the sync server password
//   create     sign in, start a fresh budget "My Finances" with an account "Checking"
//   import     sign in, open the budget, import a bank CSV with "Skip lines" = 2 (a synced per-account setting), sync
//   open       sign in, open the budget, sync (a device simply opening the app)
//   login      sign in and open the budget (a fresh browser on this build)
//   upgrade    after the server is updated: the browser still runs its cached app, opens the budget and syncs,
//              then the user accepts the update prompt
import { chromium } from 'playwright-core';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const [url, prof, step, extra] = process.argv.slice(2);
const PASS = 'witness-pass';
const ctx = await chromium.launchPersistentContext(prof, { executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, viewport: { width: 1366, height: 900 }, ...(process.getuid?.() === 0 ? { args: ['--no-sandbox'] } : {}) });
const p = ctx.pages()[0] || await ctx.newPage();
const W = ms => p.waitForTimeout(ms);
const body = async () => (await p.locator('body').innerText().catch(() => '')).replace(/\n+/g, ' | ');
const errors = []; p.on('console', m => { if (/UNIQUE|Error updating/.test(m.text())) errors.push(m.text().slice(0, 200)); });
async function signIn() {
  const pw = p.locator('input[type=password]');
  if (await pw.count() === 1) { await pw.fill(PASS); await p.getByRole('button', { name: /Sign in|OK/ }).first().click(); await W(9000); }
}
async function openBudget() {
  if (/Files \||Create new file/.test(await body())) { await p.getByText('My Finances').first().click(); await W(10000); }
}
try {
  await p.goto(url); await W(9000);
  if (step === 'bootstrap') {
    const pw = p.locator('input[type=password]');
    for (let i = 0; i < await pw.count(); i++) await pw.nth(i).fill(PASS);
    await p.getByRole('button', { name: /OK|Set password|Continue/ }).first().click(); await W(9000);
    await signIn();
  } else await signIn();
  if (step === 'create') {
    await p.getByRole('button', { name: 'Start fresh' }).click({ timeout: 60000 }); await W(10000);
    await p.getByRole('button', { name: 'Add account' }).first().click(); await p.locator('[role=dialog]').last().waitFor({ timeout: 60000 }); await W(1500);
    if (await p.getByRole('button', { name: 'Create a local account' }).count()) { await p.getByRole('button', { name: 'Create a local account' }).click(); await W(1500); }
    const d = p.locator('[role=dialog]').last(); await d.locator('input').nth(0).fill('Checking'); await d.getByRole('button', { name: /^Create$/ }).click(); await W(5000);
  }
  if (step === 'import') {
    await openBudget(); await p.getByText('Checking').first().click(); await W(4000);
    const fc = p.waitForEvent('filechooser'); await p.getByRole('button', { name: /^Import/ }).first().click(); (await fc).setFiles(join(here, extra)); await W(6000);
    const n = p.locator('[role=dialog] input[type=number]').first(); await n.fill('2'); await n.press('Tab'); await W(3000);
    await p.locator('[role=dialog]').last().getByRole('button', { name: /^Import \d/ }).first().click(); await W(6000);
  }
  if (step === 'open' || step === 'login') await openBudget();
  if (step === 'upgrade') {
    await openBudget(); await p.getByRole('button', { name: 'Sync' }).first().click().catch(() => {}); await W(6000);
    const btn = p.getByRole('button', { name: 'Update now' });
    if (await btn.count()) { await btn.first().click(); await W(12000); }
    await p.goto(url); await W(9000);
  }
  if (['import', 'open'].includes(step)) { await p.getByRole('button', { name: 'Sync' }).first().click().catch(() => {}); await W(6000); }
  const t = await body();
  console.log(`${step}: ${(t.match(/App: v[\d.]+/) || [''])[0]} ${/To Budget/.test(t) ? 'budget open' : 'budget not open'}${errors.length ? ' | ' + errors[0] : ''}`);
} catch (e) {
  console.error(`${step} failed: ${e.message}\n${(await body()).slice(0, 600)}`); process.exitCode = 1;
} finally { await ctx.close(); }
