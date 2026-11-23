// Kane's bug memory (kane-cli bugs list/show/mark/note, --agent JSON). Kane files a bug when a replay fails
// and reads its marks and the latest note in the next diagnosis of the same bug.
import { spawn } from 'node:child_process';

export interface KaneBugSummary { ref: string; family: string; page_pattern?: string; status: string; }
export interface KaneFeedback { id: string; type: string; value?: string; text?: string; retired_at: string | null; created_at: string; }
export interface KaneBug { bug: { ref: string; status: string; card: { family: string; root_cause?: string; page_pattern?: string } }; occurrences: { run_key: string }[]; feedback: KaneFeedback[]; }

export async function kaneJson(args: string[], cwd: string): Promise<any> {
  const out = await new Promise<string>((resolve) => {
    const p = spawn('kane-cli', [...args, '--agent'], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let buf = '';
    p.stdout.on('data', d => { buf += d; });
    const t = setTimeout(() => p.kill('SIGKILL'), 120_000);
    p.on('close', () => { clearTimeout(t); resolve(buf); });
  });
  const line = out.trim().split('\n').reverse().find(l => l.startsWith('{'));
  if (!line) throw new Error(`kane-cli ${args.join(' ')}: no JSON answer`);
  const j = JSON.parse(line);
  if (j.ok === false) throw new Error(`kane-cli ${args.join(' ')}: ${j.error ?? JSON.stringify(j).slice(0, 200)}`);
  return j;
}

export const listBugs = async (testFile: string, cwd: string): Promise<KaneBugSummary[]> => (await kaneJson(['bugs', 'list', testFile, '--all-families', '--limit', '200'], cwd)).bugs ?? [];
export const showBug = (ref: string, cwd: string): Promise<KaneBug> => kaneJson(['bugs', 'show', ref], cwd);
export const markBug = (ref: string, mark: string, cwd: string) => kaneJson(['bugs', 'mark', ref, mark], cwd);
export const noteBug = (ref: string, text: string, cwd: string) => kaneJson(['bugs', 'note', ref, text], cwd);
