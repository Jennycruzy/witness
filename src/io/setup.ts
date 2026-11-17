// Runs an app's own setup command to prepare state (for example an empty budget with one account) in a
// throwaway Chrome profile, before Kane runs. The command gets {url} and {profile}.
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export async function prepareProfile(command: string, url: string): Promise<{ dir: string; remove: () => void }> {
  const dir = mkdtempSync(join(tmpdir(), 'witness-profile-'));
  rmSync(dir, { recursive: true, force: true });   // the setup tool creates it
  const cmd = command.replaceAll('{url}', url).replaceAll('{profile}', dir);
  try { execSync(cmd, { stdio: 'pipe', timeout: 300_000, encoding: 'utf8' }); }
  catch (e: any) { throw new Error(`setup failed: ${cmd}\n${String(e.stderr || e.stdout || e.message).trim().split('\n').slice(-4).join('\n')}`); }
  return { dir, remove: () => rmSync(dir, { recursive: true, force: true }) };
}
