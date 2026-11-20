// State for #6794: fresh budget, account Wallet, number format 1'000.33.
import { chromium } from 'playwright-core';
const [url, prof] = process.argv.slice(2);
const ctx = await chromium.launchPersistentContext(prof, { executablePath: '/usr/bin/google-chrome', headless: true, viewport: { width: 1600, height: 900 } });
const p = ctx.pages()[0] || await ctx.newPage(); const W = ms => p.waitForTimeout(ms);
await p.goto(url); await W(6000);
if (await p.getByText(/Don.t use a server/).count()) { await p.getByText(/Don.t use a server/).click(); await W(3000); await p.getByRole('button', { name: 'Start fresh' }).click(); await W(7000); }
else { await p.getByText('Start budgeting').first().click(); await W(7000); }
await p.getByRole('button', { name: 'Add account' }).first().click(); await W(1500);
if (await p.getByRole('button', { name: 'Create a local account' }).count()) { await p.getByRole('button', { name: 'Create a local account' }).click(); await W(1500); }
const d = p.locator('[role=dialog]').last(); await d.locator('input').nth(0).fill('Wallet'); await d.getByRole('button', { name: /^Create$/ }).click(); await W(4000);
await p.goto(url.replace(/\/$/, '') + '/settings'); await W(3000);
await p.getByRole('button', { name: '1,000.33' }).first().click(); await W(1000);
await p.getByText("1'000.33", { exact: true }).last().click(); await W(1500);
console.log('FORMAT', await p.evaluate(() => [...document.querySelectorAll('button')].map(b => b.textContent).filter(t => /000\.33/.test(t)).join(',')));
await ctx.close();
