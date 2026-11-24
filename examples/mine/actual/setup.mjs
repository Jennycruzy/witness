// Prepares Actual Budget for mined tests: a fresh local budget with one empty account "Checking", on the Budget page.
// Usage: node setup.mjs <url> <chrome-profile-dir>
import { chromium } from 'playwright-core';
const [url, prof] = process.argv.slice(2);
const ctx = await chromium.launchPersistentContext(prof, { executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, viewport: { width: 1600, height: 900 }, args: process.getuid?.() === 0 ? ['--no-sandbox'] : [] });
const p = ctx.pages()[0] || await ctx.newPage();
const W = ms => p.waitForTimeout(ms);
await p.goto(url);
const noServer = p.getByText(/Don.t use a server/), startBudgeting = p.getByText('Start budgeting');
await noServer.or(startBudgeting).first().waitFor({ timeout: 60000 });
if (await noServer.count()) { await noServer.click(); await p.getByRole('button', { name: 'Start fresh' }).click({ timeout: 60000 }); await W(7000); }
else { await startBudgeting.first().click(); await W(7000); }
await p.getByRole('button', { name: 'Add account' }).first().click({ timeout: 60000 }); await W(1500);
if (await p.getByRole('button', { name: 'Create a local account' }).count()) { await p.getByRole('button', { name: 'Create a local account' }).click(); await W(1500); }
{ const d = p.locator('[role=dialog]').last(); await d.locator('input').nth(0).fill('Checking'); await d.getByRole('button', { name: /^Create$/ }).click(); await W(3500); }
for (const c of await p.getByRole('button', { name: 'Close' }).all()) { await c.click().catch(() => {}); }
await p.goto(url.replace(/\/$/, '') + '/budget'); await W(3000);
if (!(await p.getByText('Checking').count())) { console.error('setup: Checking account not created'); process.exit(1); }
console.log('setup: budget and empty Checking account ready');
await ctx.close();
