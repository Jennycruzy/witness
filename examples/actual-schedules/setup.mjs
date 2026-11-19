// Prepares Actual Budget for the completed-schedules test: a fresh local budget, an account "Checking",
// and one monthly schedule "Rent" (payee Landlord, 1,200.00). Usage: node setup.mjs <url> <chrome-profile-dir>
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
await p.goto(url.replace(/\/$/, '') + '/schedules'); await W(3000);
for (const c of await p.getByRole('button', { name: 'Close' }).all()) { await c.click().catch(() => {}); }
await p.keyboard.press('Escape'); await W(800);
await p.getByRole('button', { name: /Add new schedule/i }).click({ force: true }); await W(2000);
const d = p.locator('[role=dialog]').last(); const ins = d.locator('input');
await ins.nth(0).fill('Rent'); await W(300);
await ins.nth(1).click(); await p.keyboard.type('Landlord'); await W(800); await p.keyboard.press('Enter'); await W(800);
await ins.nth(2).click(); await p.keyboard.type('Checking'); await W(800); await p.keyboard.press('Enter'); await W(800);
await ins.nth(3).fill('1200.00'); await p.keyboard.press('Tab'); await W(800);
await d.getByRole('button', { name: /^Add$/ }).click(); await W(3000);
const rows = await p.locator('[data-testid=row]').allInnerTexts();
if (!rows.some(r => /Rent/.test(r))) { console.error('setup: Rent schedule not created'); process.exit(1); }
await p.goto(url); await W(3000);
console.log('setup: budget, Checking account and Rent schedule ready');
await ctx.close();
