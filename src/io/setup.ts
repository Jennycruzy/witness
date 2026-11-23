// Runs an app's own setup command to prepare state (for example an empty budget with one account) in a
// throwaway Chrome profile, before Kane runs. The command gets {url} and {profile}.
// It must not block: the app is served from this same process while the setup command loads it.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export async function prepareProfile(command: string, url: string, attempts = 3): Promise<{ dir: string; remove: () => void }> {
  let last: unknown;
  for (let i = 1; i <= attempts; i++) {
    try { return await prepareOnce(command, url); } catch (e) { last = e; }
  }
  throw last;
}

async function prepareOnce(command: string, url: string): Promise<{ dir: string; remove: () => void }> {
  const dir = mkdtempSync(join(tmpdir(), 'witness-profile-'));
  rmSync(dir, { recursive: true, force: true });   // the setup tool creates it
  const cmd = command.replaceAll('{url}', url).replaceAll('{profile}', dir);
  const { code, output } = await new Promise<{ code: number | null; output: string }>((resolve) => {
    const p = spawn(cmd, { shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    p.stdout.on('data', d => { output += d; });
    p.stderr.on('data', d => { output += d; });
    const t = setTimeout(() => p.kill('SIGKILL'), 300_000);
    p.on('close', (c) => { clearTimeout(t); resolve({ code: c, output }); });
  });
  if (code !== 0) { rmSync(dir, { recursive: true, force: true }); throw new Error(`setup failed (${code}): ${cmd}\n${output.trim().split('\n').slice(-12).join('\n')}`); }
  return { dir, remove: () => rmSync(dir, { recursive: true, force: true }) };
}

/** Runs one shell command with {name} placeholders filled in; throws with the last lines of output when it fails. */
export async function runCommand(command: string, vars: Record<string, string>, timeoutSec = 300): Promise<string> {
  let cmd = command;
  for (const [k, v] of Object.entries(vars)) cmd = cmd.replaceAll(`{${k}}`, v);
  const { code, output } = await new Promise<{ code: number | null; output: string }>((resolve) => {
    const p = spawn(cmd, { shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    p.stdout.on('data', d => { output += d; });
    p.stderr.on('data', d => { output += d; });
    const t = setTimeout(() => p.kill('SIGKILL'), timeoutSec * 1000);
    p.on('close', (c) => { clearTimeout(t); resolve({ code: c, output }); });
  });
  if (code !== 0) throw new Error(`command failed (${code}): ${cmd}\n${output.trim().split('\n').slice(-12).join('\n')}`);
  return output;
}
