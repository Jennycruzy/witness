// Prepares Actual Budget for the running-balance test: a fresh local budget, an account "Wallet",
// the Balance column shown, and one 20.00 deposit. Usage: node setup.mjs <url> <chrome-profile-dir>
import { chromium } from 'playwright-core';
const [url, prof] = process.argv.slice(2);
const ctx = await chromium.launchPersistentContext(prof, { executablePath: '/usr/bin/google-chrome', headless: true, viewport: { width: 1366, height: 900 } });
const p = ctx.pages()[0] || await ctx.newPage();
const W = ms => p.waitForTimeout(ms);
await p.goto(url);
const noServer = p.getByText(/Don.t use a server/), startBudgeting = p.getByText('Start budgeting');
await noServer.or(startBudgeting).first().waitFor({ timeout: 60000 });
if (await noServer.count()) { await noServer.click(); await p.getByRole('button',{name:'Start fresh'}).click({ timeout: 60000 }); await W(7000); }
else { await startBudgeting.first().click(); await W(7000); }
await p.getByRole('button',{name:'Add account'}).first().click({ timeout: 60000 }); await p.locator('[role=dialog]').last().waitFor({ timeout: 60000 }); await W(1500);
if (await p.getByRole('button',{name:'Create a local account'}).count()) { await p.getByRole('button',{name:'Create a local account'}).click(); await W(1500); }
await p.locator('[role=dialog]').last().locator('input').first().waitFor({ timeout: 60000 });
const d = p.locator('[role=dialog]').last(); await d.locator('input').nth(0).fill('Wallet'); await d.getByRole('button',{name:/^Create$/}).click(); await W(4000);
// Turn the balance column on. Older builds have "Show running balance" in the account menu; newer ones moved it
// into "Manage table columns".
await p.getByRole('button',{name:'Account menu'}).click(); await W(800);
if (await p.getByText('Show running balance').count()) { await p.getByText('Show running balance').click(); }
else {
  await p.getByText('Manage table columns').click(); const pane = p.locator('[role=dialog]').last(); await pane.waitFor({ timeout: 60000 });
  await pane.locator('input[aria-label="Running balance"]').evaluate(e => { if (!e.checked) e.click(); }); await W(300);
  await pane.getByRole('button',{name:'Save'}).click();
}
await W(1500);
await p.getByRole('button',{name:'Add New'}).click(); await W(1200);
const nr = p.locator('[data-testid="new-transaction"]');
await nr.locator('[data-testid="payee"]').click(); await W(400); await p.keyboard.type('Coffee shop'); await p.keyboard.press('Escape').catch(()=>{}); await W(400);
await nr.locator('[data-testid="credit"]').click(); await W(400); await p.keyboard.type('20.00'); await W(300);
await nr.locator('[data-testid="add-button"]').click(); await W(2500);
await p.getByRole('button',{name:'Cancel'}).click().catch(()=>{}); await W(1500);
const read = async (label) => {
  const r = p.locator('[data-testid="row"]').filter({ hasNot: p.locator('[data-testid="add-button"]') });
  const n = await r.count(); const out = [];
  for (let i = 0; i < n; i++) { const c = r.nth(i); out.push({ payee: (await c.locator('[data-testid="payee"]').innerText().catch(()=>'' )).trim(), credit: (await c.locator('[data-testid="credit"]').innerText().catch(()=>'')).trim(), balance: (await c.locator('[data-testid="balance"]').innerText().catch(()=>'')).trim() }); }
  const head = (await p.locator('body').innerText()).match(/\nWallet\n([-0-9.,]+)/g);
  console.log(label, JSON.stringify(out), 'HEADER', JSON.stringify(head));
};
await read('AFTER ADD');
await ctx.close();
